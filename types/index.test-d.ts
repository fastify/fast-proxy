import fastProxy, { fastProxy as fastProxyNamed} from '..'
import { expectAssignable, expectType } from 'tsd'

const proxy = fastProxy({
  base: 'http://127.0.0.1:3000'
})
fastProxyNamed({
  base: 'http://127.0.0.1:3000'
})

expectType<typeof fastProxyNamed>(fastProxy)
expectType<() => void>(proxy.close)
expectAssignable<Function>(proxy.proxy)
