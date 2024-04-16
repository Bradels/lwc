import { registerDecorators as _registerDecorators, createElement, LightningElement, registerComponent as _registerComponent } from "lwc";
import _tmpl from "./test.html";
class Test extends LightningElement {
  interface;
  static foo = 3;
  static baz = 1;
  /*LWC compiler vX.X.X*/
}
_registerDecorators(Test, {
  fields: ["interface"]
});
export default _registerComponent(Test, {
  tmpl: _tmpl,
  sel: "lwc-test",
  apiVersion: 9999999
});