export default function getLibraryUrlMap(): {[key: string]: string} {
  // Note that this will first process circomlib/circuits, then circomlib, so
  // both of them will point to the same place. This is intentional, as it
  // allows people who skip the /circuits import in circomlib to still pass
  return {
    "gist:": "gist.github.com/",
    "circomlib/circuits": "github.com/iden3/circomlib/blob/master/circuits",
    "circomlib": "github.com/iden3/circomlib/blob/master/circuits",
    "@zk-email/circuits": "github.com/zkemail/zk-email-verify/tree/main/packages/circuits",
    "@zk-email/contracts": "github.com/zkemail/zk-email-verify/tree/main/packages/contracts",
    "@zk-email/helpers": "github.com/zkemail/zk-email-verify/tree/main/packages/helpers",
    "@zk-email/zk-regex-circom": "github.com/zkemail/zk-regex/tree/main/packages/circom",
  };
}
