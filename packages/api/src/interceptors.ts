import type {
  InterceptorContext,
  RequestInterceptorFn,
  RequestOptions,
  ResponseEnvelope,
  ResponseInterceptorFn,
} from "./types.ts";

export class InterceptorList<
  Context,
  Value,
  F extends (context: Context, value: Value) => Value | Promise<Value>,
> {
  private readonly fns: F[] = [];

  use(fn: F): void {
    this.fns.push(fn);
  }

  async execute(context: Context, initial: Value): Promise<Value> {
    let current = initial;
    for (const fn of this.fns) {
      current = await fn(context, current);
    }
    return current;
  }
}

export function createInterceptors() {
  return {
    request: new InterceptorList<InterceptorContext, RequestOptions, RequestInterceptorFn>(),
    response: new InterceptorList<InterceptorContext, ResponseEnvelope, ResponseInterceptorFn>(),
  };
}
