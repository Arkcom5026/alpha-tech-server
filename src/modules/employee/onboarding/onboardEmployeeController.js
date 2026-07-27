const { onboardEmployee } = require('./onboardEmployeeService');

const addSubEmployee = async (req, res) => {
  try {
    const result = await onboardEmployee({
      actor: req.user || {},
      input: req.body || {},
    });

    if (result.status === 201) {
      console.log(
        `👥 [Employee Onboarding] "${result.body.data.name}" created for Branch ID: ${result.body.data.branchId}, Position ID: ${result.body.data.positionId}`,
      );
    }

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ employee onboarding error:', error);
    return res.status(500).json({
      ok: false,
      code: 'EMPLOYEE_ONBOARDING_FAILED',
      message: 'ไม่สามารถสร้างบัญชีพนักงานได้ กรุณาลองใหม่อีกครั้ง',
    });
  }
};

module.exports = { addSubEmployee };
