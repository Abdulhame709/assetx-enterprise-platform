import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

const projectRoot = resolve(process.cwd());
const date = new Date().toISOString().slice(0, 10);
const projectName = basename(projectRoot).replace(/[^A-Za-z0-9._-]+/g, '-');
const backupName = `project-backup-${projectName}-${date}`;
const outputRoot = resolve('/home/ubuntu/project-backups');
const backupRoot = join(outputRoot, backupName);

const sourceDirectories = ['client', 'server', 'shared', 'e2e', 'scripts', 'patches'];
const configFiles = [
  '.gitignore',
  '.gitkeep',
  '.prettierignore',
  '.prettierrc',
  'components.json',
  'drizzle.config.ts',
  'playwright.config.ts',
  'template.json',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.config.ts',
];
const dependencyFiles = ['package.json', 'pnpm-lock.yaml'];
const rootDocumentation = [
  'actual-invoice-analysis.json',
  'design-stability-findings-ar.md',
  'energy-actual-invoice-verification-ar.md',
  'energy-verification-matrix-ar.md',
  'excel-export-migration-research-ar.md',
  'experience-export-verification-ar.md',
  'fuel-acceptance-result.json',
  'fuel-section-acceptance-ar.md',
  'navigation-enhancements-verification-ar.md',
  'production-energy-style-verification-ar.md',
  'production-visual-verification-ar.md',
  'quality-gate-ar.md',
  'scale-security-roadmap-ar.md',
  'section-one-transition-plan-ar.md',
  'section-two-acceptance-test-ar.md',
  'security-maintenance-report-ar.md',
  'system-audit-findings-ar.md',
  'system-audit-report-ar.md',
  'todo.md',
  'unified-platform-design-ar.md',
  'visual-findings.md',
];

const excluded = [
  { path: '.git/', reason: 'سجل Git محفوظ في فرع GitHub المرتبط ولا يدخل في أرشيف الاستعادة.' },
  { path: '.manus-logs/', reason: 'سجلات تشغيل مؤقتة قد تحتوي بيانات جلسات أو تفاصيل تشغيل غير لازمة للاستعادة.' },
  { path: '.project-config.json', reason: 'إعدادات بيئة مُدارة وقد تتضمن معرفات أو إعدادات تشغيل داخلية.' },
  { path: 'node_modules/', reason: 'اعتماديات قابلة لإعادة الإنشاء بدقة من pnpm-lock.yaml.' },
  { path: 'dist/', reason: 'مخرجات بناء قابلة لإعادة الإنشاء من المصدر.' },
  { path: 'playwright-report/', reason: 'تقرير اختبار مولّد وقابل لإعادة الإنشاء.' },
  { path: 'test-results/', reason: 'نتائج اختبار مؤقتة قابلة لإعادة الإنشاء.' },
  { path: 'client/public/__manus__/version.json', reason: 'ملف إصدار مولّد بواسطة بيئة النشر.' },
  { path: '.env* وملفات *.pem و*.key', reason: 'لا تُضمَّن أسرار أو مفاتيح أو شهادات خاصة في النسخة.' },
  { path: 'سجل Git الكامل (repository.bundle)', reason: 'يُستبعد لتجنب إدراج محتوى تاريخي غير لازم؛ يحفظ GitHub سجل المشروع ومرجع النسخة داخل metadata.' },
  { path: 'بيانات قاعدة البيانات السحابية الحية', reason: 'قاعدة البيانات مُدارة خارجيًا وليست ملفًا محليًا؛ تُضمَّن المخططات والترحيلات فقط.' },
  { path: 'الأصول المرفوعة إلى التخزين السحابي', reason: 'لا توجد أصول محلية مرتبطة بالمشروع؛ يجب حفظها عبر تصدير بيانات المشروع المُدار عند الحاجة.' },
];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyIfPresent(source, destination) {
  if (await exists(source)) {
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true, preserveTimestamps: true, force: true });
    return true;
  }
  return false;
}

async function collectFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectFiles(root, fullPath)));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

async function checksum(path) {
  const file = await readFile(path);
  return createHash('sha256').update(file).digest('hex');
}

async function main() {
  await rm(backupRoot, { recursive: true, force: true });
  await mkdir(backupRoot, { recursive: true });

  for (const directory of sourceDirectories) {
    await copyIfPresent(join(projectRoot, directory), join(backupRoot, 'source', directory));
  }
  await copyIfPresent(join(projectRoot, 'drizzle'), join(backupRoot, 'database', 'drizzle'));
  await copyIfPresent(join(projectRoot, 'client', 'public'), join(backupRoot, 'assets', 'client-public'));
  await rm(join(backupRoot, 'assets', 'client-public', '__manus__'), { recursive: true, force: true });

  for (const file of configFiles) {
    await copyIfPresent(join(projectRoot, file), join(backupRoot, 'config', file));
  }
  for (const file of dependencyFiles) {
    await copyIfPresent(join(projectRoot, file), join(backupRoot, 'dependencies', file));
  }
  await copyIfPresent(join(projectRoot, 'patches'), join(backupRoot, 'dependencies', 'patches'));
  for (const file of rootDocumentation) {
    await copyIfPresent(join(projectRoot, file), join(backupRoot, 'documentation', file));
  }

  await mkdir(join(backupRoot, 'metadata'), { recursive: true });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim();
  const status = execFileSync('git', ['status', '--short', '--branch'], { cwd: projectRoot, encoding: 'utf8' }).trim();
  await writeFile(
    join(backupRoot, 'metadata', 'SOURCE_COMMIT.txt'),
    `Git commit: ${commit}\nGit status at backup: ${status || 'clean'}\nGitHub branch: manus-current-project\nGitHub repository: https://github.com/Abdulhame709/fuel-management-system\n`,
    'utf8',
  );
  const platform = `${process.platform} ${process.arch}`;
  const nodeVersion = process.version;
  const filesForManifest = await collectFiles(backupRoot);
  const fileEntries = [];
  for (const file of filesForManifest) {
    const fileStat = await stat(file);
    fileEntries.push({
      path: relative(backupRoot, file).split(sep).join('/'),
      bytes: fileStat.size,
      sha256: await checksum(file),
    });
  }
  fileEntries.sort((a, b) => a.path.localeCompare(b.path));

  const manifest = {
    backupName,
    projectName,
    createdAt: new Date().toISOString(),
    operatingSystem: platform,
    runtime: { node: nodeVersion, packageManager: 'pnpm 10.4.1' },
    projectVersion: { gitCommit: commit, githubBranch: 'manus-current-project' },
    includedFileCount: fileEntries.length,
    includedBytes: fileEntries.reduce((total, file) => total + file.bytes, 0),
    files: fileEntries,
    excluded,
    restorationRequirements: [
      'Node.js 22.13.0 أو إصدار متوافق.',
      'pnpm 10.4.1 أو إصدار متوافق.',
      'اتصال إلى قاعدة البيانات المُدارة وتعيين متغيرات البيئة يدويًا دون تضمين أي أسرار في هذا الأرشيف.',
      'صلاحية الوصول إلى التخزين السحابي وموفّر OAuth عند استعادة الوظائف التي تعتمد عليهما.',
    ],
    metadataIntegrityNote:
      'ملف BACKUP_MANIFEST.json وملف CHECKSUMS.sha256 ملفات تولّد البصمات، لذلك تُدار بصمتهما من CHECKSUMS.sha256 ولا تحوي القائمة إدخالًا دائريًا لهما.',
  };
  await writeFile(join(backupRoot, 'BACKUP_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const restoreGuide = `# دليل استعادة ${projectName}\n\n## 1. فك الضغط\n\nاستخرج ملف ZIP مع الحفاظ على البنية كاملة، ثم انقل محتويات \`source/\` و\`config/\` و\`dependencies/\` و\`database/\` إلى مجلد مشروع جديد. لا تنسخ مجلد \`metadata/\` إلى جذر التطبيق؛ فهو مخصص للتحقق والتتبع.\n\n## 2. تثبيت الاعتماديات\n\nمن جذر المشروع المستعاد، نفّذ:\n\n\`pnpm install --frozen-lockfile\`\n\nلا تُستعاد \`node_modules/\` عمدًا؛ يعيد هذا الأمر بناءها من \`pnpm-lock.yaml\`.\n\n## 3. إعداد متغيرات البيئة\n\nأنشئ ملف متغيرات محليًا حسب بيئة الاستضافة، وأدخل القيم الحقيقية يدويًا. أمثلة أسماء المتغيرات المطلوبة: \`DATABASE_URL\`، \`JWT_SECRET\`، \`OAUTH_SERVER_URL\`، ومفاتيح التخزين أو الخدمات المتصلة عند استخدامها. لا توجد مفاتيح أو رموز وصول داخل النسخة الاحتياطية.\n\n## 4. قاعدة البيانات\n\nيحتوي \`database/drizzle/\` على المخططات والترحيلات فقط. قاعدة البيانات الحية مُدارة خارجيًا وليست ملفًا محليًا ضمن الأرشيف؛ لذلك استعدها من تصدير بيانات المنصة أو من نسخة مزود قاعدة البيانات، ثم طبّق الترحيلات المطلوبة وفق سياسة البيئة قبل تشغيل التطبيق.\n\n## 5. تشغيل المشروع والتحقق\n\nبعد إعداد المتغيرات وقاعدة البيانات، نفّذ:\n\n\`pnpm check\`\n\n\`pnpm test\`\n\n\`pnpm build\`\n\n\`pnpm dev\`\n\nتحقق أيضًا من البصمات عبر \`sha256sum -c CHECKSUMS.sha256\` من جذر النسخة المستخرجة.\n\n## 6. قيود الاستعادة\n\nالأصول المرفوعة إلى التخزين السحابي، قاعدة البيانات الحية، أسرار البيئة، إعدادات OAuth، وإعدادات النشر لا يمكن استعادتها من الكود وحده. للحصول على لقطة كاملة لمنصة الويب مع قاعدة البيانات والملفات والخدمات المُدارة، استخدم تصدير بيانات المشروع المُدار بالإضافة إلى هذا الأرشيف.\n\n## 7. سجل Git\n\nسجل التغييرات محفوظ في فرع GitHub المرتبط \`manus-current-project\`، ومعرّف آخر نسخة محفوظ في \`metadata/SOURCE_COMMIT.txt\`. لم يُضمَّن أرشيف سجل Git الكامل لتقليل خطر إدراج أي محتوى تاريخي غير لازم.\n`;
  await writeFile(join(backupRoot, 'RESTORE_GUIDE.md'), restoreGuide, 'utf8');

  const checksumFiles = (await collectFiles(backupRoot)).filter(
    file => !file.endsWith(`${sep}CHECKSUMS.sha256`) && !file.endsWith(`${sep}ARCHIVE_SHA256.txt`),
  );
  const checksumLines = [];
  for (const file of checksumFiles.sort()) {
    checksumLines.push(`${await checksum(file)}  ${relative(backupRoot, file).split(sep).join('/')}`);
  }
  await writeFile(join(backupRoot, 'CHECKSUMS.sha256'), `${checksumLines.join('\n')}\n`, 'utf8');

  console.log(JSON.stringify({ backupRoot, backupName, manifestFileCount: fileEntries.length }, null, 2));
}

await main();
