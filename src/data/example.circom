pragma circom 2.0.1;

include "circomlib/poseidon.circom";

template Example () {
    signal input a;
    signal input b;
    signal output c;
    
    c <== a * b;

    assert(a > 2);
    
    component hash = Poseidon(2);
    hash.inputs[0] <== a;
    hash.inputs[1] <== b;

    log(hash.out);
}

component main { public [ a ] } = Example();

/* INPUT = {
    "a": "5",
    "b": "77"
} */