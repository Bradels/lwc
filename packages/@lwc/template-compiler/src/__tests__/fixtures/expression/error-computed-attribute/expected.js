import _implicitStylesheets from "./error-computed-attribute.css";
import _implicitScopedStylesheets from "./error-computed-attribute.scoped.css?scoped=true";
import { freezeTemplate, parseFragment, registerTemplate } from "lwc";
const $fragment1 = parseFragment`<section${3}><p${"c1"}${2}></p></section>`;
function tmpl($api, $cmp, $slotset, $ctx) {
  const {
    ncls: api_normalize_class_name,
    sp: api_static_part,
    st: api_static_fragment,
  } = $api;
  return [
    api_static_fragment($fragment1, 1, [
      api_static_part(
        1,
        {
          className: api_normalize_class_name($cmp.classNames[0]),
        },
        null
      ),
    ]),
  ];
  /*LWC compiler vX.X.X*/
}
export default registerTemplate(tmpl);
tmpl.stylesheets = [];
tmpl.stylesheetToken = "lwc-5b60b0bk9p0";
tmpl.legacyStylesheetToken =
  "x-error-computed-attribute_error-computed-attribute";
if (_implicitStylesheets) {
  tmpl.stylesheets.push.apply(tmpl.stylesheets, _implicitStylesheets);
}
if (_implicitScopedStylesheets) {
  tmpl.stylesheets.push.apply(tmpl.stylesheets, _implicitScopedStylesheets);
}
freezeTemplate(tmpl);
