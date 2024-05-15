/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import { builders as b, is } from 'estree-toolkit';
import { esTemplateWithYield } from '../estemplate';
import { bImportHtmlEscape, importHtmlEscapeKey } from './shared';
import { expressionIrToEs } from './expression';

import type {
    Expression as EsExpression,
    Identifier as EsIdentifier,
    Literal as EsLiteral,
    Statement as EsStatement,
} from 'estree';
import type {
    ComplexExpression as IrComplexExpression,
    Expression as IrExpression,
    Literal as IrLiteral,
    Text as IrText,
} from '@lwc/template-compiler';
import type { Transformer } from './types';

const bYield = (expr: EsExpression) => b.expressionStatement(b.yieldExpression(expr));

const bYieldEscapedString = esTemplateWithYield<
    EsStatement[],
    [
        EsIdentifier,
        EsExpression,
        EsIdentifier,
        EsLiteral,
        EsIdentifier,
        EsIdentifier,
        EsIdentifier,
        EsIdentifier,
        EsIdentifier
    ]
>`
    const ${is.identifier} = ${is.expression};
    if (typeof ${is.identifier} === 'string') {
        yield (${is.literal} && ${is.identifier} === '') ? '\\u200D' : htmlEscape(${is.identifier});
    } else if (typeof ${is.identifier} === 'number') {
        yield ${is.identifier}.toString();
    } else {
        yield htmlEscape((${is.identifier} ?? '').toString());
    }
`;

function isLiteral(node: IrLiteral | IrExpression | IrComplexExpression): node is IrLiteral {
    return node.type === 'Literal';
}

export const Text: Transformer<IrText> = function Text(node, cxt): EsStatement[] {
    if (isLiteral(node.value)) {
        return [bYield(b.literal(node.value.value))];
    }

    const isIsolatedTextNode = b.literal(
        (!cxt.prevSibling || cxt.prevSibling.type !== 'Text') &&
            (!cxt.nextSibling || cxt.nextSibling.type !== 'Text')
    );

    const valueToYield = expressionIrToEs(node.value, cxt);
    cxt.hoist(bImportHtmlEscape(), importHtmlEscapeKey);

    const tempVariable = b.identifier(cxt.getUniqueVar());
    return bYieldEscapedString(
        tempVariable,
        valueToYield,
        tempVariable,
        isIsolatedTextNode,
        tempVariable,
        tempVariable,
        tempVariable,
        tempVariable,
        tempVariable
    );
};
