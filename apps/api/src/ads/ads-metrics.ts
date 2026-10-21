export type AdsMetricsCalculationInput = {
  roiProtect: number
  tinRefundAmount: number
  gmvAds: number
  adsManual: number
  affiliateCost: number
  totalRevenue: number
  refundCancelRate: number
}

export function calculateAdsMetrics({
  roiProtect,
  tinRefundAmount,
  gmvAds,
  adsManual,
  affiliateCost,
  totalRevenue,
  refundCancelRate: rawRate
}: AdsMetricsCalculationInput) {
  const refundRate = Math.min(Math.max(rawRate >= 1 ? rawRate / 100 : rawRate, 0), 1)
  const actualAdsCost = Math.max(0, gmvAds - tinRefundAmount - roiProtect + adsManual)
  const affiliateRefundAmount = Math.max(0, actualAdsCost * refundRate)
  const totalCost = Math.max(0, actualAdsCost + affiliateCost)
  const adjustedRevenue = Math.max(0, totalRevenue * (1 - refundRate))
  const costAfterRefund = Math.max(0, totalCost - affiliateRefundAmount)
  const percentage = (value: number, base: number) => base > 0 ? (value / base) * 100 : 0

  return {
    refundCancelRate: Math.round(refundRate * 10_000) / 100,
    fullRefundGmv: 0,
    adsTax: 0,
    affiliateCost,
    affiliateRefundAmount,
    totalRevenue,
    adjustedRevenue,
    incomeBeforeDiscount: totalRevenue,
    incomeAfterDiscount: totalRevenue,
    actualAdsCost,
    totalCost,
    costAfterRefund,
    adsRatioOnBeforeDiscountRevenue: percentage(actualAdsCost, totalRevenue),
    totalCostRatioOnBeforeDiscountRevenue: percentage(totalCost, totalRevenue),
    costAfterRefundRatioOnBeforeDiscountRevenue: percentage(totalCost, adjustedRevenue),
    affiliateRatioOnBeforeDiscountRevenue: 0
  }
}
