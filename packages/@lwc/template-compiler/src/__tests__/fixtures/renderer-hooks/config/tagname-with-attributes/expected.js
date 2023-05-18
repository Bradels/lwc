import { parseFragment, registerTemplate, renderer } from "lwc";
const $fragment1 = parseFragment`<div${3}>Should not get custom renderer</div>`;
const stc0 = {
  city: true,
};
function tmpl($api, $cmp, $slotset, $ctx) {
  const { h: api_element, st: api_static_fragment } = $api;
  return [
    api_element(
      "div",
      {
        classMap: stc0,
        key: 0,
        renderer: renderer,
      },
      "Should get custom renderer",
      132
    ),
    api_static_fragment($fragment1(), 2),
  ];
  /*LWC compiler vX.X.X*/
}
export default registerTemplate(tmpl);
tmpl.stylesheets = [];
