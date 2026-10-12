import { useUserStore } from "../store/userStore"
import { toQueryString } from "../utils/toQuery"
import { callApi } from "./axios"
import {
  DailyAdsMetricsResponse,
  UpsertDailyAdsMetricsRequest
} from "./models"

export const useDailyAds = () => {
  const { accessToken } = useUserStore()

  const upsertDailyAdsMetrics = async (req: UpsertDailyAdsMetricsRequest) => {
    return callApi<
      UpsertDailyAdsMetricsRequest,
      { success: boolean; data: DailyAdsMetricsResponse }
    >({
      path: `/v1/dailyads/metrics`,
      method: "POST",
      data: req,
      token: accessToken
    })
  }

  const getDailyAdsMetrics = async (req: { date: Date; channelId: string }) => {
    const query = toQueryString(req)
    return callApi<never, DailyAdsMetricsResponse>({
      path: `/v1/dailyads/metrics?${query}`,
      method: "GET",
      token: accessToken
    })
  }

  const deleteAdsMetrics = async (req: { date: Date; channelId: string }) => {
    return callApi<{ date: Date; channelId: string }, { success: boolean }>({
      path: `/v1/dailyads/metrics/delete`,
      method: "DELETE",
      data: req,
      token: accessToken
    })
  }

  return {
    upsertDailyAdsMetrics,
    getDailyAdsMetrics,
    deleteAdsMetrics
  }
}
