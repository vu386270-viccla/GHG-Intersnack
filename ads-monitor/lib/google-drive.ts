import { google } from "googleapis";
import { getOAuth2Client } from "./google-auth";

export async function uploadSnapshot(
  refreshToken: string,
  imageBuffer: Buffer,
  fileName: string,
  folderName: string
): Promise<{ fileId: string; webViewLink: string }> {
  const auth = getOAuth2Client();
  auth.setCredentials({ refresh_token: refreshToken });

  const drive = google.drive({ version: "v3", auth });

  // Find or create the root "Ads Monitor" folder
  const rootFolder = await findOrCreateFolder(drive, "Ads Monitor");
  // Find or create campaign subfolder
  const subFolder = await findOrCreateFolder(drive, folderName, rootFolder);

  const { data } = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: "image/png",
      parents: [subFolder],
    },
    media: {
      mimeType: "image/png",
      body: require("stream").Readable.from(imageBuffer),
    },
    fields: "id, webViewLink",
  });

  // Make file readable by anyone with the link
  await drive.permissions.create({
    fileId: data.id!,
    requestBody: { role: "reader", type: "anyone" },
  });

  return {
    fileId: data.id!,
    webViewLink: data.webViewLink!,
  };
}

async function findOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId?: string
): Promise<string> {
  const query = [
    `name='${name}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    parentId ? `'${parentId}' in parents` : null,
  ]
    .filter(Boolean)
    .join(" and ");

  const { data } = await drive.files.list({ q: query, fields: "files(id)" });

  if (data.files && data.files.length > 0) return data.files[0].id!;

  const { data: created } = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });

  return created.id!;
}
