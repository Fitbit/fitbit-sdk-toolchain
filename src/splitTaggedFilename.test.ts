import splitTaggedFilename from './splitTaggedFilename';

describe('when the filename does not contain a tag, it returns the filename unchanged', () => {
    const vectors = ['filename.png', 'foo', 'foo.bar.baz', '~', '~.png', 'foo.png~', 'foo~', 'foo~.png', ''];

    vectors.forEach(vector =>
        test(vector, () =>
            expect(splitTaggedFilename(vector)).toMatchObject({
                basename: vector,
                tag: undefined,
            })
        )
    );
});

describe('when the filename contains a tag, it parses out the tag', () => {
    const vectors = [
        ['foo~tag.png', 'foo.png', 'tag'],
        ['foo~bar~baz.png', 'foo.png', 'bar~baz'],
        ['bar~tag~.png', 'bar.png', 'tag~'],
        ['foo~~.png', 'foo.png', '~'],
        ['woop~~woop.png', 'woop.png', '~woop'],
        ['a.b~c', 'a.b', 'c'],
        ['~tilde.png', '.png', 'tilde'],
        ['index~tag.test.js', 'index.test.js', 'tag'],
    ];

    vectors.forEach(([vector, basename, tag]) => test(vector, () => expect(splitTaggedFilename(vector)).toMatchObject({ basename, tag })));
});
