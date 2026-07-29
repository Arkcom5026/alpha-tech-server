const repository = require('./accountantWorkspaceRepository');
const service = require('./accountantWorkspaceService');

const normalizePositiveInt = (value) => {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : undefined;
};

const resolveUserId = (req) =>
  normalizePositiveInt(req.user?.id || req.user?.userId || req.user?.sub);

const handle = (operation) => async (req, res, next) => {
  try {
    const data = await operation(req);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

const listBusinesses = handle((req) =>
  service.listBusinesses({
    repository,
    userId: resolveUserId(req),
    externalOrganizationId: req.params.externalOrganizationId,
  }),
);

const getBusinessWorkspace = handle((req) =>
  service.getBusinessWorkspace({
    repository,
    userId: resolveUserId(req),
    externalOrganizationId: req.params.externalOrganizationId,
    businessId: req.params.businessId,
  }),
);

module.exports = {
  getBusinessWorkspace,
  listBusinesses,
};
