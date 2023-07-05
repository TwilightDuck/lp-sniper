import Big from "big.js";

const Big_BASE = Big(1000);
const ZERO = Big(0);
const ONE = Big(1);
const TWO = Big(2);

/** sqrt() function for Big https://github.com/dholms/Big-sqrt */
function BigSqrt(num: Big): Big {
    if(num.lt(ZERO)) {
        throw new Error("Sqrt only works on non-negtiave inputs");
    }
    
    if(num.lt(TWO)) {
        return num;
    }
    
    const smallCand = BigSqrt(num.div(4)).mul(2);
    const largeCand = smallCand.add(ONE);
    
    if (largeCand.mul(largeCand).gt(num)) {
        return smallCand;
    } else {
        return largeCand;
    }
}

/** Calculate the optimal trading amount for an arbitrage */
export function calculateAmountIn(a1: Big, b1: Big, a2: Big, b2: Big, c: Big): Big {
    let r = Big_BASE.sub(c);
    let a = a1.mul(b2).div(b1.mul(r).div(Big_BASE).add(b2));
    let a_ = a2.mul(b1).mul(r).div(Big_BASE).div(b1.mul(r).div(Big_BASE).add(b2));
    let d = BigSqrt(a.mul(a_).mul(r).div(Big_BASE)).sub(a).mul(Big_BASE).div(r);
    return d.gt(ZERO) ? d : ZERO;
}

export function calculateProfit(delta: Big, a1: Big, b1: Big, a2: Big, b2: Big, c: Big): Big {
    let r = Big_BASE.sub(c);
    let a = a1.mul(b2).div(b1.mul(r).div(Big_BASE).add(b2));
    let a_ = a2.mul(b1).mul(r).div(Big_BASE).div(b1.mul(r).div(Big_BASE).add(b2));
    let delta_ = a_.mul(delta).mul(r).div(Big_BASE).div(delta.mul(r).div(Big_BASE).add(a));
    return delta_.sub(delta);
}