

// =============================================================
// File: controllers/utils/address.js
// Desc: Joiners & ADM helpers used by controllers (resolve/join/build)
// Note: Exported as `addressUtil` to match addressController import
// =============================================================

const { prisma, Prisma } = require('../lib/prisma')

function joinAddress({ address, subdistrict, district, province, postalCode }) {
  return [address, subdistrict, district, province, postalCode].filter(Boolean).join(' ');
}

async function getAdmFromSubdistrictCode(subdistrictCode) {
  try {
    if (!subdistrictCode) return {};
    const code = String(subdistrictCode);
    const sd = await prisma.subdistrict.findUnique({
      where: { code },
      include: { district: { include: { province: true } } },
    });
    if (!sd) return {};
    return {
      subdistrict: sd.nameTh,
      district: sd.district?.nameTh,
      province: sd.district?.province?.nameTh,
      postcode: sd.postcode || undefined,
    };
  } catch (err) {
    // ให้ผู้เรียกตัดสินใจจัดการ error เอง
    throw err;
  }
}

async function buildBranchAddress(branch) {
  const adm = await getAdmFromSubdistrictCode(branch?.subdistrictCode);
  return joinAddress({
    address: branch?.address,
    subdistrict: adm.subdistrict,
    district: adm.district,
    province: adm.province,
    postalCode: branch?.postalCode || adm.postcode,
  });
}

module.exports.addressUtil = { joinAddress, getAdmFromSubdistrictCode, buildBranchAddress };
