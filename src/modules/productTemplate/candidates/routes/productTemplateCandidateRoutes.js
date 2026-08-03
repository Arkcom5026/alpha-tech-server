const express = require('express')
const verifyToken = require('../../../../../middlewares/verifyToken')
const {
  createProductTemplateCandidate,
} = require('../create/createProductTemplateCandidateController')

const router = express.Router()

const requireSuperAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').trim().toUpperCase()
  if (role !== 'SUPERADMIN') {
    return res.status(403).json({ error: 'Forbidden', code: 'SUPERADMIN_REQUIRED' })
  }
  return next()
}

router.use(verifyToken)
router.use(requireSuperAdmin)
router.post('/', createProductTemplateCandidate)

module.exports = router
