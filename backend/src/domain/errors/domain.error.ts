/**
 * Base Domain Error class.
 * All domain-specific errors inherit from this class.
 */
export abstract class DomainError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
  }
}

export class RateLimitExceededError extends DomainError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMIT_EXCEEDED';

  constructor(public readonly resetSeconds: number) {
    super(`Too many requests. Please wait ${resetSeconds} seconds before sending another message.`);
  }
}

export class ChannelNotConfiguredError extends DomainError {
  readonly statusCode = 503;
  readonly code = 'CHANNEL_NOT_CONFIGURED';

  constructor(public readonly platform: string) {
    super(`Bot channel '${platform}' is not configured yet. Please configure credentials in Web UI Settings.`);
  }
}

export class ProviderUnavailableError extends DomainError {
  readonly statusCode = 502;
  readonly code = 'PROVIDER_UNAVAILABLE';

  constructor(public readonly providerName: string, reason?: string) {
    super(`LLM Provider '${providerName}' is currently unavailable.${reason ? ` Reason: ${reason}` : ''}`);
  }
}

export class AllProvidersFailedError extends DomainError {
  readonly statusCode = 502;
  readonly code = 'ALL_PROVIDERS_FAILED';

  constructor(public readonly errors: Record<string, string>) {
    super(`All configured LLM providers failed to generate a response.`);
  }
}

export class AuthenticationError extends DomainError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHENTICATED';

  constructor(message = 'Invalid authentication credentials.') {
    super(message);
  }
}

export class EntityNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly code = 'ENTITY_NOT_FOUND';

  constructor(entityName: string, id: string) {
    super(`${entityName} with identifier '${id}' was not found.`);
  }
}

export class ValidationError extends DomainError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
  }
}
