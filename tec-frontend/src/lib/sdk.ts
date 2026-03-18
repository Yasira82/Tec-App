// tec-frontend/src/lib/sdk.ts
import { TecSdk } from '@yasser172/tec-sdk'

export const sdk = new TecSdk({
  gatewayUrl: process.env.NEXT_PUBLIC_API_GATEWAY_URL || 
    'https://api-gateway-production-6a68.up.railway.app',
})

export default sdk
