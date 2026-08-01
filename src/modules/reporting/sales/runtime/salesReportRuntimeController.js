const salesReportRuntimeService = require('./salesReportRuntimeService');

const getSalesDashboard = async (req, res) => {
  try {
    const result = await salesReportRuntimeService.getSalesDashboard({
      branchId: Number(req.user?.branchId),
      query: req.query || {},
    });
    return res.status(result.status).json(result.body);
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
    return res.status(result.status).json(result.body);
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
    return res.status(result.status).json(result.body);
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
    return res.status(result.status).json(result.body);
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
    return res.status(result.status).json(result.body);
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
