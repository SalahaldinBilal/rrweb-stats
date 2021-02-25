class Stats{
    static sum(arr, formula){
        formula = (formula === undefined || formula === null) ? e => e: formula;
        let sum = 0;
        for(let index in arr) sum += formula(arr[index], arr[+index+1]);
        return sum;
    }

    static mean(arr, formula){
        return this.sum(arr, formula)/arr.length;
    }

    static standardDeviation(arr, mean, formula){
        formula = (formula === undefined || formula === null) ? e => e: formula;
        mean = (mean === undefined || mean === null) ? this.mean(arr, formula) : mean;
        return Math.sqrt(this.sum(arr, e => Math.pow(formula(e) - mean, 2)) / arr.length);
    }
};

export {Stats};