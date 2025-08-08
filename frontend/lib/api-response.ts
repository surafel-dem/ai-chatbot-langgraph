/**
 * Standardized API response utilities
 */

export class ApiResponse {
  static json<T>(data: T, status = 200): Response {
    return Response.json(data, { status });
  }

  static error(message: string, status = 400): Response {
    return Response.json({ error: message }, { status });
  }

  static unauthorized(): Response {
    return this.error('Unauthorized', 401);
  }

  static forbidden(): Response {
    return this.error('Forbidden', 403);
  }

  static notFound(resource = 'Resource'): Response {
    return this.error(`${resource} not found`, 404);
  }

  static serverError(message = 'Internal server error'): Response {
    return this.error(message, 500);
  }

  static success(message = 'Success'): Response {
    return this.json({ success: true, message });
  }
}