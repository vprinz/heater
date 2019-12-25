const heaterNotWork = 0;
const heaterWork = 1;
const timeForActivateHeater = 18;
const timeForDeactivateHeater = 12;
const humidityLimit = 0x2FAE; // 80%
const voltsForActivateHeater = 0xD3; // 66 вольт

class HSensor {
    static humidity = [10, 100];
    static voltage = [0.45, 9.2];

    constructor(num) {
        this.num = num;
    }

    get() {
        return document.getElementById(`dv${this.num}-text`).value;
    }
}

class TSensor {

    get() {
        return +document.querySelector("input[name=dt]").checked;
    }
}

class ADC {
    /*
        Analog-to-digital converter (eng)
        АЦП (рус)
     */
    static bits = 14;
    static voltage = [0, 10];

    constructor(swtch) {
        this.switch = swtch;
    }

    get() {
        return this.transform(this.switch.get())
    }

    transform(volts) {
        let k = ((HSensor.voltage[1] - HSensor.voltage[0]) / (HSensor.humidity[1] - HSensor.humidity[0])).toFixed(1);
        let U = k * (volts - HSensor.humidity[0]) + HSensor.voltage[0];
        let D = ((U - ADC.voltage[0]) / (ADC.voltage[1] - ADC.voltage[0])) * 2 ** ADC.bits;
        return Math.round(D);
    }
}

class DAC {
    /*
        Digital-to-analog converter (eng)
        ЦАП (рус)
     */
    static bits = 8;
    static voltage = [0, 80];

    constructor() {
        this.heater = new Heater();
        this.input = null;
        this.output = null;
    }

    set(time, activation) {
        if (activation) {
            this.output = this.heater.turnOn(time);
        } else {
            this.output = this.heater.turnOff(time);
        }
        this.transform();
        this.heater.set(this.input);
    }

    transform() {
        this.input = Math.round((this.output / (DAC.voltage[1] - DAC.voltage[0])) * 2 ** DAC.bits);
    }
}

class Switch {
    hSensors = [
        new HSensor(1),
        new HSensor(3),
        new HSensor(5),

        new HSensor(7),
        new HSensor(9),
        new HSensor(11),

        new HSensor(2),
        new HSensor(4),
        new HSensor(6),

        new HSensor(8),
        new HSensor(10),
        new HSensor(12)
    ];

    constructor() {
        this.port = null;
    }

    set(port) {
        this.port = port;
    }

    get() {
        return this.hSensors[this.port].get();
    }
}

class Heater {
    constructor() {
        this.mode = heaterNotWork;
    }

    set(volts) {
        switch (volts) {
            case voltsForActivateHeater:
                this.mode = heaterWork;
                break;
            case 0:
                this.mode = heaterNotWork;
                break;
        }
    }

    turnOn(time) {
        let k = 11 / 3;
        let volts = k * time;
        return Math.round(volts);
    }

    turnOff(time) {
        let k = 11 / 2;
        let volts = k * time;
        return Math.round(volts);
    }
}

class UVM {
    constructor() {
        this.time = 0;
        this.count = 0;
        this.timeForTurnOnHeater = 0;
        this.timeForTurnOffHeater = timeForDeactivateHeater;
        this.humiditySumStates = [true, true, true, true];
        this.temperature_mode = 0;
        this.currentHumiditiesSum = 0;
        this.sensorGroups = {
            'firstGroup': [0b0000, 0b0001, 0b0010],
            'secondGroup': [0b0011, 0b0100, 0b0101],
            'thirdGroup': [0b0110, 0b0111, 0b1000],
            'fourthGroup': [0b1001, 0b1010, 0b1011],
        };
        this.humidities = [];
        this.saveHumidities = [];
        this.activeSensors = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        this.switch = new Switch();
        this.temperatureSensor = new TSensor();
        this.adc = new ADC(this.switch);
        this.dac = new DAC();
    }

    getHumidity(groupSensors) {
        for (let i = 0; i < groupSensors.length; i++) {
            let num = groupSensors[i];
            this.switch.set(num);
            this.saveHumidities[num] = this.switch.get();
            this.humidities[num] = this.adc.get();
            this.activeSensors[num] = 1;
        }
    }

    calculateHumidity(groupSensors) {
        let sum = 0;
        for (let i = 0; i < groupSensors.length; i++) {
            sum = sum + this.humidities[groupSensors[i]];
        }
        return sum;
    }

    checkHumiditySumStates() {
        for (let i = 0; i < this.currentHumiditiesSum.length; i++) {
            this.humiditySumStates[i] = this.currentHumiditiesSum[i] < humidityLimit;
        }
        return this.humiditySumStates;
    }

    step() {
        this.activeSensors = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

        let firstGroup = this.sensorGroups['firstGroup'];
        let secondGroup = this.sensorGroups['secondGroup'];
        let thirdGroup = this.sensorGroups['thirdGroup'];
        let fourthGroup = this.sensorGroups['fourthGroup'];

        this.getHumidity(firstGroup);
        if (this.count % 2 === 0) {
            this.getHumidity(secondGroup);
        }
        if (this.count % 3 === 0) {
            this.getHumidity(thirdGroup);
        }
        if (this.count % 4 === 0) {
            this.getHumidity(fourthGroup);
        }

        this.temperature_mode = this.temperatureSensor.get();
        this.currentHumiditiesSum = [
            this.calculateHumidity(firstGroup),
            this.calculateHumidity(secondGroup),
            this.calculateHumidity(thirdGroup),
            this.calculateHumidity(fourthGroup),
        ];

        let heaterMode = this.dac.heater.mode;
        let isMoreHumidity = this.checkHumiditySumStates().includes(false);
        if (isMoreHumidity) {
            this.temperature_mode = 1;
            this.timeForTurnOffHeater = timeForDeactivateHeater;
            if (this.timeForTurnOnHeater <= timeForActivateHeater) {
                this.dac.set(this.timeForTurnOnHeater, true);
            }
            this.timeForTurnOnHeater += 2;
        } else {
            this.temperature_mode = 0;
            this.timeForTurnOnHeater = 0;
            if (heaterMode === 1) {
                if (this.timeForTurnOffHeater >= 0) {
                    this.dac.set(this.timeForTurnOffHeater, false);
                }
                this.timeForTurnOffHeater -= 2;
            }
        }

        this.count++;
        if (this.count === 14) {
            this.count = 0;
        }
        this.time += 2;
    }
}


const hex = (num) => "0x" + num.toString(16).toUpperCase();
const uvm = new UVM();
const heater = document.getElementById("heater");
const step = () => {
    uvm.step();
    document.getElementById("time").innerHTML = uvm.time;

    if (uvm.temperature_mode === 0) {

        if (uvm.dac.heater.mode === 0) {
            document.getElementById("dac-in").innerHTML = hex('0');
            document.getElementById("dac-out").innerHTML = '0';
        } else {
            document.getElementById("dac-in").innerHTML = hex(uvm.dac.input);
            document.getElementById("dac-out").innerHTML = uvm.dac.output;
        }

        document.getElementById("mode").innerHTML = uvm.dac.heater.mode;

        document.querySelector("input[name=dt]").checked = 0;
        document.getElementById(`dt`).innerHTML = "Температура в норме (0)";
        document.getElementById(`dt`).style.color = "green";

        heater.style.transition = '1s';
        heater.classList.remove('activation');

        // Опрос Датчиков Влажности
        uvm.activeSensors.forEach((el, i) => {
            if (el) {
                document.getElementById(`dv${i + 1}`).setAttribute("fill", "palegreen");
                document.getElementById(`sw${i}`).style.color = "green";
                document.getElementById(`sw${i}`).innerHTML = "Active";
                document.getElementById(`v${i + 1}`).innerHTML = `${uvm.saveHumidities[i]}%`;
                document.getElementById(`v${i + 1}-adc`).innerHTML = hex(uvm.humidities[i]);
            } else {
                document.getElementById(`dv${i + 1}`).setAttribute("fill", "white");
                document.getElementById(`sw${i}`).style.color = "red";
                document.getElementById(`sw${i}`).innerHTML = "Inactive";
                document.getElementById(`v${i + 1}-adc`).innerHTML = "";
            }
        });

    } else {
        document.querySelector("input[name=dt]").checked = 1;
        document.getElementById(`dt`).innerHTML = "Температура не в норме (1)";
        document.getElementById(`dt`).style.color = "red";

        heater.style.transition = '3s';
        heater.classList.add('activation');

        document.getElementById("dac-in").innerHTML = hex(uvm.dac.input);
        document.getElementById("dac-out").innerHTML = uvm.dac.output;
        document.getElementById("mode").innerHTML = uvm.dac.heater.mode;
    }
};

document.getElementById("step").addEventListener('click', step);

let interval;
document.getElementById("start").addEventListener('click', (e) => {
    interval = setInterval(step, 500);
    document.getElementById("stop").disabled = false;
    document.getElementById("start").disabled = true;
    document.getElementById("step").disabled = true;
});

document.getElementById("stop").addEventListener('click', (e) => {
    clearInterval(interval);
    document.getElementById("stop").disabled = true;
    document.getElementById("start").disabled = false;
});

document.querySelectorAll('.slider').forEach((el) => el.addEventListener('input', (e) => {
    const id = e.target.dataset.id;
    document.getElementById(`dv${id}-text`).value = e.target.value;
}));

