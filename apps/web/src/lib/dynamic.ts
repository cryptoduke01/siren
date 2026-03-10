export const DYNAMIC_ENVIRONMENT_ID =
  process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID || "";

export function isDynamicConfigured(): boolean {
  return !!DYNAMIC_ENVIRONMENT_ID;
}
