// scripts/test-template-search.js
const { prisma, logHeader, pass, getTemplateBranch } = require('./runtime-test-utils');
const { TemplateProductSearchService } = require('../src/modules/product/services/templateProductSearchService');

async function main() {
  logHeader('P1 Runtime Test: Template Product Search');

  const search = process.env.TEST_TEMPLATE_SEARCH || 'canon';
  const takeNum = Number(process.env.TEST_TAKE_NUM || 20);

  const branch = await getTemplateBranch();
  console.log('Template Branch:', branch);

  const service = new TemplateProductSearchService(prisma);
  const results = await service.searchTemplateProducts({ search, takeNum });

  console.log(`Search: ${search}`);
  console.log(`Found: ${results.length}`);

  results.slice(0, 10).forEach((p, i) => {
    console.log(`${i + 1}. #${p.id} ${p.name} | ${p.productTypeName || '-'} | ${p.brandName || '-'}`);
  });

  if (!Array.isArray(results)) throw new Error('Search result is not an array');
  if (results.length <= 0) throw new Error('Template search returned 0 rows');

  const invalid = results.find((p) => p.isTemplateProduct !== true || p.templateBranchCode !== branch.branchCode);
  if (invalid) throw new Error(`Invalid template result: ${JSON.stringify(invalid)}`);

  pass('Template search PASS');
}

main()
  .catch((error) => {
    console.error('\n❌ Template search FAIL');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
