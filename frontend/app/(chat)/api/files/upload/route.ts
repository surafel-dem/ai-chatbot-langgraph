// Uploads are disabled in this build. Return 410 Gone to signal removal.
export async function POST() {
  return new Response('File uploads are disabled', { status: 410 });
}
