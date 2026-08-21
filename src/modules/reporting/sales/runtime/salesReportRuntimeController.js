const salesReportRuntimeService = require('./salesReportRuntimeService');

const getSalesDashboard = async (req, res) => {
  try {
    const result = await salesReportRuntimeService.getSalesDashboard({
      branchId: Number(req.user?.branchId),
      query: req.query || {},
    });
    return res.json(result);
  } catch (error) {
    console.error('❌ [getSalesDashboard] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึง dashboard รายงานการขายได้' });
  }
};

const getSalesList = async (req, res) => {
  try {
    const result = await salesReportRuntimeService.getSalesList({
      branchId: Number(req.user?.branchId),
      query: req.query || {},
    });
    return res.json(result);
  } catch (error) {
    console.error('❌ [getSalesList] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงรายการขายได้' });
  }
};

const getProductPerformance = async (req, res) => {
  try {
    const result = await salesReportRuntimeService.getProductPerformance({
      branchId: Number(req.user?.branchId),
      query: req.query || {},
    });
    return res.json(result);
  } catch (error) {
    console.error('❌ [getProductPerformance] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลวิเคราะห์สินค้าได้' });
  }
};

const getSalesDetail = async (req, res) => {
  try {
    const result = await salesReportRuntimeService.getSalesDetail({
      branchId: Number(req.user?.branchId),
      saleId: Number(req.params?.saleId),
    });
    if (!result) return res.status(404).json({ message: 'ไม่พบรายการขาย' });
    return res.json(result);
  } catch (error) {
    console.error('❌ [getSalesDetail] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงรายละเอียดบิลขายได้' });
  }
};

const getSalesTaxReport = async (req, res) => {
  try {
    const result = await salesReportRuntimeService.getSalesTaxReport({
      branchId: Number(req.user?.branchId),
      startDate: req.query?.startDate,
      endDate: req.query?.endDate,
    });
    if (result?.invalidDate) {
      return res.status(400).json({ message: 'ช่วงวันที่รายงานภาษีขายไม่ถูกต้อง' });
    }
    return res.json(result);
  } catch (error) {
    console.error('❌ [getSalesTaxReport] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงรายงานภาษีขายได้' });
  }
};

module.exports = {
  getSalesDashboard,
  getSalesList,
  getProductPerformance,
  getSalesDetail,
  getSalesTaxReport,
};
