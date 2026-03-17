import { Effect } from 'effect';

export type UnsupportedEffectClient = {
  readonly _tag: 'UnsupportedEffectClient';
};

export function makeApiClient(): Effect.Effect<
  UnsupportedEffectClient,
  Error,
  never
> {
  return Effect.fail(
    new Error(
      'makeApiClient is not implemented yet. Use createApiClient from @mock-dash/api.',
    ),
  );
}
