What's with the modules named .const.ts?
----------------------------------------

This is not just a convention; the naming scheme solves a real problem
with the browser build. Those modules take a specific form: they export
only constants, but those constants are computed at module evaluation
time from other files in the node_modules structures. This pattern is
very problematic when bundling for the web as we do not want to ship the
whole bloated node_modules tree on every page load, just for a couple of
small files. And we don't want to hardcode the constants since that
would be WET, and we would inevitably forget to keep them in sync.

The Webpack `aot-loader` solves this quite nicely. It imports modules at
bundle time, while they're in their native node_modules habitat,
serializes the modules' exports to JSON and puts the JSON in the bundle
in place of the module's code. This only works for modules whose exports
can be serialized to JSON without any loss of fidelity, so it cannot be
blanket applied to all modules. The `.const` suffix flags the file as
being safe (or necessary) for processing by `aot-loader` when bundling.
The toolchain browser bundle Webpack config has a rule to only apply
`aot-loader` to files matching that pattern.

When should I throw a BuildError?
---------------------------------

Throwing a `BuildError` surfaces that error to the developer in a clear way
and attributes the error to the component that was being built at the time.
Use a `BuildError` when something went wrong as a result of a developer's bad
action or configuration.
