export default function AnnotatedPromise(annotation, promise) {
  return promise.then(resolved => [annotation, resolved]);
}

