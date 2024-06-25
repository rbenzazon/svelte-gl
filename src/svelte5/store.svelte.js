class CounterClass {
	num = $state(1);
	title = $derived(this.num * 2);
	increment() {
		this.num += this.num;
	}
}

export const counter = new CounterClass();
