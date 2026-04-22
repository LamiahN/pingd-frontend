var adminApp = new Vue({
    el: '#adminApp', 

    // app state
    data: {
        email: '',
        password: '',
        admin: null,
        message: '',
        mode: 'login',
        queues: [],
        queueEntries: {},
        userNames: {}
    },

    methods: {

        // for admin login, store admin data in app state, move to dashboard view, fetch queues for the restaurant
        async login() {
            try {
                const res = await fetch('https://pingd-backend.onrender.com/adminLogin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: this.email,
                        password: this.password
                    })
                });

                const data = await res.json();

                if (data.message === "Invalid credentials") {
                    alert("Invalid email or password");
                    return;
                }
                
                alert("Login successful");

                // store admin data in app state 
                this.admin = data.admin;

                console.log("FULL ADMIN OBJECT:", this.admin);

                this.message = "Login successful";

                // move to dashboard
                this.mode = 'dashboard';
                await this.fetchQueues(); // fetch queues after login

            } catch (error) {
                console.error(error);
                this.message = "Error logging in";
            }
        },

        // fetch queues for the restaurant and store in queues
        async fetchQueues() {
            try {
                
                console.log("Admin restaurantID:", this.admin.restaurantID);

                let url;

                if (typeof this.admin.restaurantID === "number") {
                    url = `https://pingd-backend.onrender.com/adminQueues/${this.admin.restaurantID}`;
                } else {
                    url = `https://pingd-backend.onrender.com/adminQueuesTakeaway/${this.admin.restaurantID}`;
                }

                const res = await fetch(url);
                const data = await res.json();
        
                this.queues = data;
        
                // load entries for each queue
                for (let q of this.queues) {
                    await this.fetchEntries(q._id);
                }
        
            } catch (error) {
                console.error(error);
            }
        },

        // fetch entries for a specific queue and store in queueEntries
        async fetchEntries(queueId) {
            try {
                const res = await fetch(`https://pingd-backend.onrender.com/queueEntries/${queueId}`);
                const data = await res.json();
        
                this.$set(this.queueEntries, queueId, data);

                for (let q of this.queues) {
                    const entries = this.queueEntries[q._id];
                
                    if (entries) {
                        for (let entry of entries) {
                
                            if (!this.userNames[entry.userId]) {
                                this.fetchUserName(entry.userId).then(name => {
                                    this.$set(this.userNames, entry.userId, name);
                                });
                            }
                
                        }
                    }
                }
        
            } catch (error) {
                console.error(error);
            }
        },

        // mark a user as ready, notify them, refresh the queue entries
        async setReady(userId, queueId) {
            try {
                await fetch('https://pingd-backend.onrender.com/notifyCustomer', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: userId,
                        queueId: queueId
                    })
                });
        
                // refresh entries
                await this.fetchEntries(queueId);
        
            } catch (error) {
                console.error(error);
            }
        },

        // remove a user from the dine-in queue, refresh the queue entries, if takeaway: also refresh the queues ( to update the admin view)
        async removeUser(userId, queueId) {
            try {
                await fetch('https://pingd-backend.onrender.com/leaveQueue', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: userId,
                        queueId: queueId
                    })
                });
        
                // refresh entries
                await this.fetchEntries(queueId);
        
            } catch (error) {
                console.error(error);
            }
        },

        // remove a user from the takeaway queue, refresh the queue entries, refresh the queues ( to update the admin view)
        async removeTakeawayUser(userId, queueId) {
            try {
                const res = await fetch('https://pingd-backend.onrender.com/leaveTakeawayQueue', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: userId,
                        queueId: queueId
                    })
                });
        
                const data = await res.json();
                console.log(data);
        
                // refresh admin view
                await this.fetchQueues();
        
            } catch (error) {
                console.error(error);
            }
        },

        // logout the admin, clear all data from the app state, return to login screen
        logout() {
            if (confirm("Are you sure you want to logout?")) {
                this.admin = null;
                this.email = '';
                this.password = '';
                this.mode = 'login';
            }
        },

        // fetch a customer's full name by their userId, used to display customer names in the queue entries
        async fetchUserName(userId) {
            try {
                const res = await fetch(`https://pingd-backend.onrender.com/user/${userId}`);
                const data = await res.json();
        
                return data.fullName;
            } catch (err) {
                console.log("Error fetching user:", err);
                return "Unknown user";
            }
        }
    },

    // periodically refresh the queues and entries every 3 seconds (keep admin view up to date)
    mounted() {
        setInterval(() => {
            if (this.mode === 'dashboard') {
                this.fetchQueues();
            }
        }, 3000); 
    }
});