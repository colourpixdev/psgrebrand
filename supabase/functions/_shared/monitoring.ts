export function getRequestId(request: Request) {
  return request.headers.get('x-request-id') || crypto.randomUUID();
}

export function logFunctionEvent(functionName: string, event: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    function: functionName,
    event,
    ...details,
  }));
}
