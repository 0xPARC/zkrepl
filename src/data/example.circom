include "circomlib/mimc.circom";

template Example () {  
    signal input a;  
    signal input b;  
    signal output c;  
    
    c <== a * b;  
    log(c);


    component mimc = MiMC7(91);
    mimc.x_in <== a;
    mimc.k <== 22;
    log(mimc.out);

    log(111111111);  
}

component main = Example();

/* INPUT = {
    "a": "2",
    "b": "77"
} */