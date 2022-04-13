/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { walk } from 'estree-walker';
import { NormalizedConfig } from '../config';

import * as t from '../shared/estree';
import {
    BaseElement,
    ChildNode,
    Element,
    Expression,
    Literal,
    LWCDirectiveRenderMode,
    Root,
} from '../shared/types';
import { PARSE_FRAGMENT_METHOD_NAME, TEMPLATE_PARAMS } from '../shared/constants';
import {
    isBaseElement,
    isComment,
    isComponent,
    isPreserveCommentsDirective,
    isRenderModeDirective,
    isSlot,
    isText,
} from '../shared/ast';
import { isArrayExpression, isLiteral } from '../shared/estree';
import {
    isAllowedFragOnlyUrlsXHTML,
    isFragmentOnlyUrl,
    isIdReferencingAttribute,
    isSvgUseHref,
} from '../parser/attribute';
import { serializeStaticElement } from './helpers';

type RenderPrimitive =
    | 'iterator'
    | 'flatten'
    | 'element'
    | 'slot'
    | 'customElement'
    | 'bind'
    | 'text'
    | 'dynamicText'
    | 'dynamicCtor'
    | 'key'
    | 'tabindex'
    | 'scopedId'
    | 'scopedFragId'
    | 'comment'
    | 'sanitizeHtmlContent'
    | 'staticFragment';

interface RenderPrimitiveDefinition {
    name: string;
    alias: string;
}

const RENDER_APIS: { [primitive in RenderPrimitive]: RenderPrimitiveDefinition } = {
    iterator: { name: 'i', alias: 'api_iterator' },
    flatten: { name: 'f', alias: 'api_flatten' },
    element: { name: 'h', alias: 'api_element' },
    slot: { name: 's', alias: 'api_slot' },
    customElement: { name: 'c', alias: 'api_custom_element' },
    dynamicCtor: { name: 'dc', alias: 'api_dynamic_component' },
    bind: { name: 'b', alias: 'api_bind' },
    text: { name: 't', alias: 'api_text' },
    dynamicText: { name: 'd', alias: 'api_dynamic_text' },
    key: { name: 'k', alias: 'api_key' },
    tabindex: { name: 'ti', alias: 'api_tab_index' },
    scopedId: { name: 'gid', alias: 'api_scoped_id' },
    scopedFragId: { name: 'fid', alias: 'api_scoped_frag_id' },
    comment: { name: 'co', alias: 'api_comment' },
    sanitizeHtmlContent: { name: 'shc', alias: 'api_sanitize_html_content' },
    staticFragment: { name: 'st', alias: 'api_static_fragment' },
};

interface Scope {
    parent: Scope | null;
    declaration: Set<string>;
}

function getStaticNodes(root: Root): Set<ChildNode> {
    const hoistedNodes = new Set<ChildNode>();

    function isStaticNode(node: BaseElement): boolean {
        let result = true;
        const {
            name: nodeName,
            namespace = '',
            attributes,
            directives,
            properties,
            listeners,
        } = node;

        result &&= !isSlot(node); // slot element can't be static.
        result &&= !isComponent(node); // components are not static.

        // it is an element.
        result &&= !attributes.some(({ name, value }) => {
            return (
                !isLiteral(value) ||
                name === 'slot' ||
                // check for ScopedId
                name === 'id' ||
                name === 'spellcheck' || // spellcheck is specially handled by the vnodes. @todo: alternatively we could add/remove those that are static
                isIdReferencingAttribute(name) ||
                // Check for ScopedFragId
                (isSvgUseHref(nodeName, name, namespace) &&
                    isFragmentOnlyUrl(value.value as string)) ||
                (isAllowedFragOnlyUrlsXHTML(nodeName, name, namespace) &&
                    isFragmentOnlyUrl(value.value as string))
            );
        }); // all attrs are static
        result &&= directives.length === 0; // do not have any directive
        result &&= properties.every((prop) => isLiteral(prop.value)); // all properties are static
        result &&= listeners.length === 0; // do not have any event listener

        return result;
    }

    function collectStaticNodes(node: ChildNode) {
        let childrenAreStatic = true;
        let nodeIsStatic;

        if (isText(node)) {
            nodeIsStatic = isLiteral(node.value);
        } else if (isComment(node)) {
            nodeIsStatic = true;
        } else {
            // it is ForBlock | If | BaseElement
            node.children.forEach((childNode) => {
                collectStaticNodes(childNode);

                childrenAreStatic = childrenAreStatic && hoistedNodes.has(childNode);
            });

            nodeIsStatic = isBaseElement(node) && isStaticNode(node);
        }

        if (nodeIsStatic && childrenAreStatic) {
            // let's unmark the children as static. So in the codegen we generate the outermost static node.
            if (isBaseElement(node)) {
                node.children.forEach((childNode) => hoistedNodes.delete(childNode));
            }
            hoistedNodes.add(node);
        }
    }

    root.children.forEach((childNode) => collectStaticNodes(childNode));

    return hoistedNodes;
}

export default class CodeGen {
    /** The AST root. */
    readonly root: Root;

    /** The template render mode. */
    readonly renderMode: LWCDirectiveRenderMode;

    /** Indicates whether the generated code should preserve HTML comments or not. */
    readonly preserveComments: boolean;

    /**
     * This flag indicates if the generated code should scope the template fragment id. It is set to
     * true if the template also contains ids.
     *
     * TODO [#1150]: Remove this code once we can figure out how to do this in a deterministic
     * fashion.
     */
    readonly scopeFragmentId: boolean;

    /**
     * The scope keeps track of the identifiers that have been seen while traversing the AST.
     * Currently, we are keeping track of item, index and iterator on the ForEach and ForOf nodes respectively.
     *
     * Scope is used in bindExpression to determine if the expression is a known identifier.
     * A known identifier exists if it exists in the scope chain.
     */
    private scope: Scope;

    readonly staticNodes: Set<ChildNode>;
    readonly hoistedNodes: t.Expression[] = [];

    currentId = 0;
    currentKey = 0;
    innerHtmlInstances = 0;

    usedApis: { [name: string]: t.Identifier } = {};
    usedLwcApis: Set<string> = new Set();

    slotNames: Set<string> = new Set();
    memorizedIds: t.Identifier[] = [];
    referencedComponents: Set<string> = new Set();

    constructor({
        root,
        config,
        scopeFragmentId,
    }: {
        root: Root;
        config: NormalizedConfig;
        scopeFragmentId: boolean;
    }) {
        this.root = root;
        this.staticNodes = getStaticNodes(root);
        this.renderMode =
            root.directives.find(isRenderModeDirective)?.value.value ??
            LWCDirectiveRenderMode.shadow;
        this.preserveComments =
            root.directives.find(isPreserveCommentsDirective)?.value.value ??
            config.preserveHtmlComments;

        this.scopeFragmentId = scopeFragmentId;
        this.scope = this.createScope();
    }

    generateKey() {
        return this.currentKey++;
    }

    genElement(tagName: string, data: t.ObjectExpression, children: t.Expression) {
        const args: t.Expression[] = [t.literal(tagName), data];
        if (!isArrayExpression(children) || children.elements.length > 0) {
            args.push(children); // only generate children if non-empty
        }
        return this._renderApiCall(RENDER_APIS.element, args);
    }

    genCustomElement(
        tagName: string,
        componentClass: t.Identifier,
        data: t.ObjectExpression,
        children: t.Expression
    ) {
        this.referencedComponents.add(tagName);

        const args: t.Expression[] = [t.literal(tagName), componentClass, data];
        if (!isArrayExpression(children) || children.elements.length > 0) {
            args.push(children); // only generate children if non-empty
        }

        return this._renderApiCall(RENDER_APIS.customElement, args);
    }
    genDynamicElement(
        tagName: string,
        ctor: t.Expression,
        data: t.ObjectExpression,
        children: t.Expression
    ) {
        const args: t.Expression[] = [t.literal(tagName), ctor, data];
        if (!isArrayExpression(children) || children.elements.length > 0) {
            args.push(children); // only generate children if non-empty
        }

        return this._renderApiCall(RENDER_APIS.dynamicCtor, args);
    }

    genText(value: Array<string | t.Expression>): t.Expression {
        const mappedValues = value.map((v) => {
            return typeof v === 'string'
                ? t.literal(v)
                : this._renderApiCall(RENDER_APIS.dynamicText, [v]);
        });

        let textConcatenation: t.Expression = mappedValues[0];

        for (let i = 1, n = mappedValues.length; i < n; i++) {
            textConcatenation = t.binaryExpression('+', textConcatenation, mappedValues[i]);
        }

        return this._renderApiCall(RENDER_APIS.text, [textConcatenation]);
    }

    genComment(value: string): t.Expression {
        return this._renderApiCall(RENDER_APIS.comment, [t.literal(value)]);
    }

    genSanitizeHtmlContent(content: t.Expression): t.Expression {
        return this._renderApiCall(RENDER_APIS.sanitizeHtmlContent, [content]);
    }

    genIterator(iterable: t.Expression, callback: t.FunctionExpression) {
        return this._renderApiCall(RENDER_APIS.iterator, [iterable, callback]);
    }

    genBind(handler: t.Expression) {
        return this._renderApiCall(RENDER_APIS.bind, [handler]);
    }

    genFlatten(children: t.Expression[]) {
        return this._renderApiCall(RENDER_APIS.flatten, children);
    }

    genKey(compilerKey: t.SimpleLiteral, value: t.Expression) {
        return this._renderApiCall(RENDER_APIS.key, [compilerKey, value]);
    }

    genScopedId(id: string | t.Expression): t.CallExpression {
        if (typeof id === 'string') {
            return this._renderApiCall(RENDER_APIS.scopedId, [t.literal(id)]);
        }
        return this._renderApiCall(RENDER_APIS.scopedId, [id]);
    }

    genScopedFragId(id: string | t.Expression): t.CallExpression {
        if (typeof id === 'string') {
            return this._renderApiCall(RENDER_APIS.scopedFragId, [t.literal(id)]);
        }
        return this._renderApiCall(RENDER_APIS.scopedFragId, [id]);
    }

    getSlot(slotName: string, data: t.ObjectExpression, children: t.Expression) {
        this.slotNames.add(slotName);

        return this._renderApiCall(RENDER_APIS.slot, [
            t.literal(slotName),
            data,
            children,
            t.identifier('$slotset'),
        ]);
    }

    genTabIndex(children: [t.Expression]) {
        return this._renderApiCall(RENDER_APIS.tabindex, children);
    }

    getMemorizationId() {
        const currentId = this.currentId++;
        const memorizationId = t.identifier(`_m${currentId}`);

        this.memorizedIds.push(memorizationId);

        return memorizationId;
    }

    genBooleanAttributeExpr(bindExpr: t.Expression) {
        return t.conditionalExpression(bindExpr, t.literal(''), t.literal(null));
    }

    /**
     * This routine generates an expression that avoids
     * computing the sanitized html of a raw html if it does not change
     * between renders.
     *
     * @param expr
     * @returns sanitizedHtmlExpr
     */
    genSanitizedHtmlExpr(expr: t.Expression) {
        const instance = this.innerHtmlInstances++;

        // Optimization for static html.
        // Example input: <div lwc:inner-html="foo">
        // Output: $ctx._sanitizedHtml$0 || ($ctx._sanitizedHtml$0 = api_sanitize_html_content("foo"))
        if (t.isLiteral(expr)) {
            return t.logicalExpression(
                '||',
                t.memberExpression(
                    t.identifier(TEMPLATE_PARAMS.CONTEXT),
                    t.identifier(`_sanitizedHtml$${instance}`)
                ),
                t.assignmentExpression(
                    '=',
                    t.memberExpression(
                        t.identifier(TEMPLATE_PARAMS.CONTEXT),
                        t.identifier(`_sanitizedHtml$${instance}`)
                    ),
                    this.genSanitizeHtmlContent(expr)
                )
            );
        }

        // Example input: <div lwc:inner-html={foo}>
        // Output: $ctx._rawHtml$0 !== ($ctx._rawHtml$0 = $cmp.foo)
        //             ? ($ctx._sanitizedHtml$0 = api_sanitize_html_content($cmp.foo))
        //             : $ctx._sanitizedHtml$0
        //
        // Note: In the case of iterations, when the lwc:inner-html bound value depends on the
        //       iteration item, the generated expression won't be enough, and `sanitizeHtmlContent`
        //       will be called every time because this expression is based on the specific template
        //       usage of the lwc:inner-html, and in an iteration, usages are dynamically generated.
        return t.conditionalExpression(
            t.binaryExpression(
                '!==',
                t.memberExpression(
                    t.identifier(TEMPLATE_PARAMS.CONTEXT),
                    t.identifier(`_rawHtml$${instance}`)
                ),
                t.assignmentExpression(
                    '=',
                    t.memberExpression(
                        t.identifier(TEMPLATE_PARAMS.CONTEXT),
                        t.identifier(`_rawHtml$${instance}`)
                    ),
                    expr
                )
            ),
            t.assignmentExpression(
                '=',
                t.memberExpression(
                    t.identifier(TEMPLATE_PARAMS.CONTEXT),
                    t.identifier(`_sanitizedHtml$${instance}`)
                ),
                this.genSanitizeHtmlContent(expr)
            ),
            t.memberExpression(
                t.identifier(TEMPLATE_PARAMS.CONTEXT),
                t.identifier(`_sanitizedHtml$${instance}`)
            )
        );
    }

    private _renderApiCall(
        primitive: RenderPrimitiveDefinition,
        params: t.Expression[]
    ): t.CallExpression {
        const { name, alias } = primitive;

        let identifier = this.usedApis[name];
        if (!identifier) {
            identifier = this.usedApis[name] = t.identifier(alias);
        }

        return t.callExpression(identifier, params);
    }

    beginScope(): void {
        this.scope = this.createScope(this.scope);
    }

    private createScope(parent: Scope | null = null): Scope {
        return {
            parent,
            declaration: new Set(),
        };
    }

    endScope(): void {
        if (!this.scope.parent) {
            throw new Error("Can't invoke endScope if the current scope has no parent");
        }

        this.scope = this.scope.parent;
    }

    declareIdentifier(identifier: t.Identifier): void {
        this.scope.declaration.add(identifier.name);
    }

    /**
     * Searches the scopes to find an identifier with a matching name.
     */
    isLocalIdentifier(identifier: t.Identifier): boolean {
        let scope: Scope | null = this.scope;

        while (scope !== null) {
            if (scope.declaration.has(identifier.name)) {
                return true;
            }

            scope = scope.parent;
        }

        return false;
    }

    /**
     * Bind the passed expression to the component instance. It applies the following transformation to the expression:
     * - {value} --> {$cmp.value}
     * - {value[index]} --> {$cmp.value[$cmp.index]}
     */
    bindExpression(expression: Expression | Literal): t.Expression {
        if (t.isIdentifier(expression)) {
            if (!this.isLocalIdentifier(expression)) {
                return t.memberExpression(t.identifier(TEMPLATE_PARAMS.INSTANCE), expression);
            } else {
                return expression;
            }
        }

        const scope = this;
        walk(expression, {
            leave(node, parent) {
                if (
                    parent !== null &&
                    t.isIdentifier(node) &&
                    t.isMemberExpression(parent) &&
                    parent.object === node &&
                    !scope.isLocalIdentifier(node)
                ) {
                    this.replace(t.memberExpression(t.identifier(TEMPLATE_PARAMS.INSTANCE), node));
                }
            },
        });

        return expression as t.Expression;
    }

    genHoistedElement(element: Element, slotParentName?: string): t.Expression {
        const key =
            slotParentName !== undefined
                ? `@${slotParentName}:${this.generateKey()}`
                : this.generateKey();
        const html = serializeStaticElement(element);

        this.usedLwcApis.add(PARSE_FRAGMENT_METHOD_NAME);

        // building the taggedTemplate expression as if it were a string
        const expr = t.taggedTemplateExpression(
            t.identifier(PARSE_FRAGMENT_METHOD_NAME),
            t.templateLiteral(
                [
                    {
                        type: 'TemplateElement',
                        tail: true,
                        value: {
                            raw: html,
                            cooked: html,
                        },
                    },
                ],
                []
            )
        );

        this.hoistedNodes.push(expr);

        const idx = this.hoistedNodes.length;
        return this._renderApiCall(RENDER_APIS.staticFragment, [
            t.callExpression(t.identifier(`$fragment${idx}`), []),
            t.literal(key),
        ]);
    }
}
