const deleteEmployee = async (_req, res) => res.status(405).json({
  code: 'EMPLOYEE_HARD_DELETE_DISABLED',
  message: 'ไม่อนุญาตให้ลบประวัติพนักงาน กรุณาเปลี่ยนสถานะเป็นไม่ใช้งานแทน',
});

module.exports = { deleteEmployee };
