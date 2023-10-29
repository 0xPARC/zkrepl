export default function getLibraryUrlMap(): {[key: string]: string} {
  return {
    "gist:": "gist.github.com/",
    "circomlib": "github.com/iden3/circomlib/blob/master",
    "@zk-email/circuits": "github.com/zkemail/zk-email-verify/tree/main/packages/circuits",
    "@zk-email/contracts": "github.com/zkemail/zk-email-verify/tree/main/packages/contracts",
    "@zk-email/helpers": "github.com/zkemail/zk-email-verify/tree/main/packages/helpers",
    "@zk-email/zk-regex-circom": "github.com/zkemail/zk-regex/tree/main/packages/circom",
  };
}
