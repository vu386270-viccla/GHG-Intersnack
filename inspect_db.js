import fs from 'fs';

const filePath = './src/app/page.tsx';
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  console.log("Searching for roadmap in page.tsx:");
  lines.forEach((line, index) => {
    if (line.includes('roadmapS12') || line.includes('roadmapS3')) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
}
