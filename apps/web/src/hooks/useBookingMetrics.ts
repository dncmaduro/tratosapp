import { toQueryString } from "../utils/toQuery"
import { useUserStore } from "../store/userStore"
import { callApi } from "./axios"
import {
  BookingMetricsResponse,
  DeleteBookingMetricsRequest,
  GetBookingMetricsRequest,
  GetBookingMetricsResponse,
  UpsertBookingMetricsRequest
} from "./models"

export const useBookingMetrics = () => {
  const { accessToken } = useUserStore()

  const upsertBookingMetrics = async (req: UpsertBookingMetricsRequest) => {
    return callApi<UpsertBookingMetricsRequest, { success: boolean; data: BookingMetricsResponse }>({
      path: "/v1/dailybookings/metrics",
      method: "POST",
      data: req,
      token: accessToken
    })
  }

  const getBookingMetrics = async (req: GetBookingMetricsRequest) => {
    const query = toQueryString(req)
    return callApi<never, GetBookingMetricsResponse>({
      path: `/v1/dailybookings/metrics?${query}`,
      method: "GET",
      token: accessToken
    })
  }

  const deleteBookingMetrics = async (req: DeleteBookingMetricsRequest) => {
    return callApi<DeleteBookingMetricsRequest, { success: boolean }>({
      path: "/v1/dailybookings/metrics/delete",
      method: "DELETE",
      data: req,
      token: accessToken
    })
  }

  return { upsertBookingMetrics, getBookingMetrics, deleteBookingMetrics }
}
