import { z } from 'zod';
import { tool, experimental_generateImage, type FileUIPart } from 'ai';
import { getImageModel } from '@/lib/ai/providers';
import { DEFAULT_IMAGE_MODEL } from '@/lib/ai/all-models';
import OpenAI, { toFile } from 'openai';
import { uploadFile } from '@/lib/blob';

interface GenerateImageProps {
  attachments?: Array<FileUIPart>;
  lastGeneratedImage?: { imageUrl: string; name: string } | null;
}

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const generateImage = ({
  attachments = [],
  lastGeneratedImage = null,
}: GenerateImageProps = {}) =>
  tool({
    description: `Generate images from text descriptions. Can optionally use attached images as reference.

Use for:
- Create images, artwork, illustrations from descriptive prompts
- Generate visual content based on user requests
- Support various art styles and subjects
- Be as detailed as possible in the description
- Use attached images as visual reference when available`,
    inputSchema: z.object({
      prompt: z
        .string()
        .describe(
          'Detailed description of the image to generate. Include style, composition, colors, mood, and any other relevant details.',
        ),
    }),
    execute: async ({ prompt }) => {
      // Filter only image file parts for reference
      const imageParts = attachments.filter(
        (part) => part.type === 'file' && part.mediaType?.startsWith('image/'),
      );

      const hasLastGeneratedImage = lastGeneratedImage !== null;
      const isEdit = imageParts.length > 0 || hasLastGeneratedImage;
      console.log('CAlling generateImageTool with isEdit', isEdit);
      if (isEdit) {
        console.log(
          'Using OpenAI edit mode with images:',
          `lastGenerated: ${hasLastGeneratedImage ? 1 : 0}, attachments: ${imageParts.length}`,
        );

        // Convert parts and lastGeneratedImage to the format expected by OpenAI
        const inputImages = [];

        // Add lastGeneratedImage first if it exists
        if (lastGeneratedImage) {
          const response = await fetch(lastGeneratedImage.imageUrl);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const lastGenImage = await toFile(buffer, lastGeneratedImage.name, {
            type: 'image/png',
          });
          inputImages.push(lastGenImage);
        }

        // Add user file parts
        const partImages = await Promise.all(
          imageParts.map(async (part) => {
            const response = await fetch(part.url);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Use toFile to create the proper format for OpenAI
            return await toFile(buffer, part.filename || 'image.png', {
              type: part.mediaType || 'image/png',
            });
          }),
        );

        inputImages.push(...partImages);

        const rsp = await openaiClient.images.edit({
          model: 'gpt-image-1',
          image: inputImages, // Pass all images to OpenAI
          prompt,
        });

        // Convert base64 to buffer and upload to blob storage
        const buffer = Buffer.from(rsp.data?.[0]?.b64_json || '', 'base64');
        const timestamp = Date.now();
        const filename = `generated-image-${timestamp}.png`;

        const result = await uploadFile(filename, buffer);

        return {
          imageUrl: result.url,
          prompt,
        };
      }

      // Non-edit case: use experimental_generateImage
      const res = await experimental_generateImage({
        model: getImageModel(DEFAULT_IMAGE_MODEL),
        prompt,
        n: 1,
        providerOptions: {
          telemetry: { isEnabled: true },
        },
      });

      console.log('res', res);

      // Convert base64 to buffer and upload to blob storage
      const buffer = Buffer.from(res.images[0].base64, 'base64');
      const timestamp = Date.now();
      const filename = `generated-image-${timestamp}.png`;

      const result = await uploadFile(filename, buffer);

      return {
        imageUrl: result.url,
        prompt,
      };
    },
  });
