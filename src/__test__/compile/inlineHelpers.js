class Foo {
    doFoo() {}
}
class Bar extends Foo {
    doBar() {
        console.log('foo');
    }
}
const bar = new Bar();
bar.doBar();
