'use strict'

const { createStoreDeviceRegistryAuthority } = require('../contracts/storeDeviceRegistryAuthority')
const { requireBranchAuthority } = require('../policies/storeDeviceAuthorityPolicy')

const registry = createStoreDeviceRegistryAuthority()

const withStatus = (action) => {
  try {
    return action()
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = error.code === 'STORE_DEVICE_NOT_FOUND' ? 404 : 400
    }
    throw error
  }
}

const register = ({ user, payload }) => withStatus(() => registry.register({
  ...payload,
  branchId: requireBranchAuthority(user),
}))

const list = ({ user }) => registry.list(requireBranchAuthority(user))

const detail = ({ user, deviceId }) => withStatus(() => registry.detail({
  branchId: requireBranchAuthority(user),
  deviceId,
}))

const rename = ({ user, deviceId, payload }) => withStatus(() => registry.rename({
  branchId: requireBranchAuthority(user),
  deviceId,
  name: payload?.name,
}))

const assignWorkstation = ({ user, deviceId, payload }) => withStatus(() => registry.assignWorkstation({
  branchId: requireBranchAuthority(user),
  deviceId,
  workstationId: payload?.workstationId,
}))

const revoke = ({ user, deviceId }) => withStatus(() => registry.revoke({
  branchId: requireBranchAuthority(user),
  deviceId,
}))

module.exports = { register, list, detail, rename, assignWorkstation, revoke }
