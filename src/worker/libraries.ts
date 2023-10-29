export default function getLibraryUrlMap(): {[key: string]: string} {
  // Note that to avoid long circomlib import delays, those libraries are all
  // pre-cached and not fetched from URLs. This can reduce compilation by 66% on complex circuits.
    return {
    "gist:": "gist.github.com/",
    "@zk-email/circuits": "github.com/zkemail/zk-email-verify/tree/main/packages/circuits",
    "@zk-email/contracts": "github.com/zkemail/zk-email-verify/tree/main/packages/contracts",
    "@zk-email/helpers": "github.com/zkemail/zk-email-verify/tree/main/packages/helpers",
    "@zk-email/zk-regex-circom": "github.com/zkemail/zk-regex/tree/main/packages/circom",
  };
}
