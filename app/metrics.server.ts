export class Metrics {
    private metrics: { [name: string]: number } = {};

    public putMetric(name: string, value: number) {
        this.metrics[name] = value;
    }

    public flush() {
       Object.entries(this.metrics).forEach(([name, value]) => {
           console.log(`Metric ${name} is ${value}`);
       });
    }
}