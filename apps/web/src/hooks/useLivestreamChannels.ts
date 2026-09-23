import { useUserStore } from "../store/userStore"
import { toQueryString } from "../utils/toQuery"
import { callApi } from "./axios"
import {
  CreateLivestreamChannelRequest,
  DeleteLivestreamChannelRequest,
  GetLivestreamChannelDetailResponse,
  LivestreamChannel,
  SearchLivestreamChannelsRequest,
  SearchLivestreamChannelsResponse,
  UpdateLivestreamChannelRequest
} from "./models"

/**
 * Hook for livestream channels operations
 * Temporary compatibility hook for Tratosapp TikTok channels.
 */
export const useLivestreamChannels = () => {
  const { accessToken } = useUserStore()

  const createLivestreamChannel = async (
    req: CreateLivestreamChannelRequest
  ) => {
    return callApi<CreateLivestreamChannelRequest, LivestreamChannel>({
      method: "POST",
      path: `/v1/channels`,
      data: req,
      token: accessToken
    })
  }

  const searchLivestreamChannels = async (
    req: SearchLivestreamChannelsRequest
  ) => {
    const query = toQueryString(req)

    return callApi<never, SearchLivestreamChannelsResponse>({
      method: "GET",
      path: `/v1/channels?${query}`,
      token: accessToken
    })
  }

  const getLivestreamChannelDetail = async (id: string) => {
    return callApi<never, GetLivestreamChannelDetailResponse>({
      method: "GET",
      path: `/v1/channels/${id}`,
      token: accessToken
    })
  }

  const updateLivestreamChannel = async (
    id: string,
    req: UpdateLivestreamChannelRequest
  ) => {
    return callApi<UpdateLivestreamChannelRequest, never>({
      method: "PATCH",
      path: `/v1/channels/${id}`,
      data: req,
      token: accessToken
    })
  }

  const deleteLivestreamChannel = async (
    req: DeleteLivestreamChannelRequest
  ) => {
    return callApi<never, never>({
      method: "DELETE",
      path: `/v1/channels/${req.id}`,
      token: accessToken
    })
  }

  return {
    createLivestreamChannel,
    searchLivestreamChannels,
    getLivestreamChannelDetail,
    updateLivestreamChannel,
    deleteLivestreamChannel
  }
}
