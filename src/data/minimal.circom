pragma circom 2.0.1;


template Example () {
    signal input a;
    signal input b;
    signal output c;
    
    c <== a * b;

    assert(a > 2);
}

component main { public [ a ] } = Example();

/* INPUT = {
    "a": "5",
    "b": "77"
} */