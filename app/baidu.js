ZOHO.embeddedApp.on("PageLoad", async function (data) {
    let Current_User = await getCurrentUser();

    let toggleSwitch = document.getElementById("toggleSwitch");
    let toggleText = document.getElementById("toggleText");
    let progressBar = document.getElementById("progressBar");
    let statusMessage = document.getElementById("statusMessage");
    let logData = await getData();
    logData = logData.filter(item => item.Created_By.id === Current_User.id);

    let isCheckedIn = logData.length > 0 ? logData[0].checkincheckoutbaidu__Status === 'Checked-In' : false;

    if (isCheckedIn) {
        toggleSwitch.checked = isCheckedIn;
        toggleText.innerText = 'Check Out';
    }

    function showLoading() {
        statusMessage.style.display = "block";
        progressBar.style.display = "block";
        toggleSwitch.disabled = true;
    }

    function hideLoading() {
        statusMessage.style.display = "none";
        progressBar.style.display = "none";
        toggleSwitch.disabled = false;
    }
    async function getCurrentUser() {
        try {
            let res = await ZOHO.CRM.CONFIG.getCurrentUser();
            if (!res) throw new Error(res);
            return res.users[0];
        } catch (error) {
            throw new Error(error);
        }
    }
    async function getData() {
        try {
            let response = await ZOHO.CRM.API.getAllRecords({ Entity: "checkincheckoutbaidu__Attendance", page: 1 });
            if (!response?.data) {
                if (response?.status === 204) return [];
                throw new Error(`${response.status}`);
            }
            return response?.data;
        } catch (error) {
            console.error(error)
            throw new Error(error);
        }
    }
    async function createRecord(lat, long, time) {
        let name, count, splittedValues;
        const today = new Date();
        const formattedDate = today.toLocaleDateString('en-US'); // Adjust locale to match your needs
        if (logData.length > 0) {
            splittedValues = logData[0].Name.split('_');
            if (splittedValues[0] === formattedDate) {
                count = Number(splittedValues[1]);
                name = `${splittedValues[0]}_${++count}`;
            }
        } else {
            name = `${formattedDate}_1`;
        }
        var recordData = {
            "checkincheckoutbaidu__Check_in_Latitude": `${lat}`,
            "checkincheckoutbaidu__Check_in_Longitude": `${long}`,
            "checkincheckoutbaidu__Check_In_Time": `${time}`,
            "Name": name,
            "checkincheckoutbaidu__Check_out_Latitude": '-',
            "checkincheckoutbaidu__Check_out_Longitude": '-',
            "checkincheckoutbaidu__Check_out_Time": '-',
            "checkincheckoutbaidu__Status": "Checked-In",
            "checkincheckoutbaidu__Duration": "-"
        }
        try {
            let response = await ZOHO.CRM.API.insertRecord({ Entity: "checkincheckoutbaidu__Attendance", APIData: recordData, Trigger: ["workflow"] });
            if (response?.data[0]?.status === "error") throw new Error(response?.data[0]?.message);
            return true;
        } catch (error) {
            throw new Error(error);
        }
    }

    async function updateRecord(lat, long, time) {
        let latestRecords = await getData();

        let FilteredRecords = latestRecords.filter(item => item.Created_By.id === Current_User.id);

        let check_in_time = new Date(FilteredRecords[0].checkincheckoutbaidu__Check_In_Time);
        let duration = new Date(time).getTime() - check_in_time.getTime();

        // Convert the duration from milliseconds to hours, minutes, and seconds
        const hours = Math.floor(duration / (1000 * 60 * 60));  // Hours
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));  // Minutes
        const seconds = Math.floor((duration % (1000 * 60)) / 1000);  // Seconds

        // Format the result as hr:min:sec
        const formattedDuration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        let config = {
            Entity: "checkincheckoutbaidu__Attendance",
            APIData: {
                "id": FilteredRecords[0].id,
                "checkincheckoutbaidu__Check_out_Latitude": `${lat}`,
                "checkincheckoutbaidu__Check_out_Longitude": `${long}`,
                "checkincheckoutbaidu__Check_out_Time": `${time}`,
                "checkincheckoutbaidu__Status": "Checked-Out",
                "checkincheckoutbaidu__Duration": formattedDuration
            },
            Trigger: ["workflow"]
        }
        try {
            let response = await ZOHO.CRM.API.updateRecord(config);
            if (response?.data[0]?.status === "error") throw new Error(response?.data[0]?.message);
            return true;
        } catch (error) {
            throw new Error(error);
        }


    }

    async function updateTable() {
        const tableBody = document.getElementById("tableBody");
        logData = await getData();
        logData = logData.filter(item => item.Created_By.id === Current_User.id);
        tableBody.innerHTML = logData.length ? logData.map((entry, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${entry.Name}</td>
                    <td>${entry.checkincheckoutbaidu__Check_In_Time}</td>
                    <td>${entry.checkincheckoutbaidu__Check_in_Latitude}</td>
                    <td>${entry.checkincheckoutbaidu__Check_in_Longitude}</td>
                    <td>${entry.checkincheckoutbaidu__Check_out_Time}</td>
                    <td>${entry.checkincheckoutbaidu__Check_out_Latitude}</td>
                    <td>${entry.checkincheckoutbaidu__Check_out_Longitude}</td>
                    </tr>
                    `).join('') : `<tr class="no-records"><td colspan="11">No records found</td></tr>`;
    }
    // <td>${entry.checkincheckoutbaidu__Duration} </td>
    document.querySelector('#toggleSwitch').addEventListener('change', toggleCheckInOut);
    async function toggleCheckInOut() {
        showLoading();
        navigator.geolocation.getCurrentPosition(async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const timeNow = new Date().toLocaleString();

            if (!isCheckedIn) {
                await createRecord(lat, lon, timeNow);
                toggleText.innerText = "Check Out";
            } else {
                await updateRecord(lat, lon, timeNow);
                toggleText.innerText = "Check In";
            }

            isCheckedIn = !isCheckedIn;
            await updateTable();
            hideLoading();
        }, () => {
            alert("Unable to fetch location. Please check your GPS settings.");
            hideLoading();
        });
    }

    await updateTable();
})

ZOHO.embeddedApp.init();
