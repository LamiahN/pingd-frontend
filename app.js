var UGproject = new Vue({
    el: '#app', 
    
    // app state
    data: {

        mode: 'login', 
        currentUser: null, 

        signup: {
            fullName: '',
            email: '',
            password: ''
        },
        login: {
            email: '',
            password: ''
        },
        message: '',
        queuePosition: null,
        queueStatus: '',
        estimatedWaitTime: null,
        partySize: null,
        leaveQueueMessage: '',
        acceptTableMessage: '',
        waitLongerMessage: '',
        forfeitTableMessage: '',
        restaurants:[],
        selectedRestaurant: null,
        menuItems: [],
        trendingItems: [],
        recommendedRestaurants: [],
        queueSummaries: {},
        userQueues: [],
        selectedQueue: null,
        isFetchingQueues: false,
        searchTerm: '',
        sortOption: '',
        selectedCuisine: '',
        takeawayRestaurants: [],
        readyHandled: false, // flag to prevent multiple alerts for same ready status
        countdownTime: 0,
        elapsedSeconds: 0,
        searchQuery: '',
        selectedRating: '',
        sortOption: '',
        dineInRestaurants: [],
        showBrowseModal: false,
        activeFilter:'all',
        takeawaySearch: '',
        takeawaySortOption: '',
        takeawayFilter: 'all',
        takeawayCuisine: '',
        faqs: [ // for FAQs page in profile section
            {
                question: "How does Pingd work?",
                answer: "You join a queue digitally and get notified when your table or order is ready.",
                open: false
            },
            {
                question: "Can I leave a queue?",
                answer: "Yes, you can leave the queue anytime from the queue details screen.",
                open: false
            },
            {
                question: "What happens if I’m late?",
                answer: "Your spot may be given to the next person, depending on the restaurant’s policy.",
                open: false
            },
            {
                question: "How accurate is the wait time?",
                answer: "Wait times are based on real-time queue data and update dynamically.",
                open: false
            }
        ]
    },
    methods: {

        async signupUser() {
            // Empty field check
            if (!this.signup.fullName || !this.signup.email || !this.signup.password || !this.signup.dob) {
                this.message = "Please fill in all fields";
                return;
            }
        
            // Email format check
            const emailRegex = /\S+@\S+\.\S+/;
            if (!emailRegex.test(this.signup.email)) {
                this.message = "Enter a valid email address";
                return;
            }
        
            // Password length check
            if (this.signup.password.length < 6) {
                this.message = "Password must be at least 6 characters";
                return;
            }

            // Age check (must be at least 13 years old)
            const today = new Date();
            const dob = new Date(this.signup.dob);

            let age = today.getFullYear() - dob.getFullYear();
            const monthDiff = today.getMonth() - dob.getMonth();

            console.log("Age:", age, "Month Diff:", monthDiff, "Today Date:", today.getDate(), "DOB Date:", dob.getDate());

            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                age--;
            }

            if (age < 13) {
                this.message = "You must be at least 13 years old";
                return;
            }
        
            // if all checks pass proceed with signup
            const res = await fetch('https://pingd-backend.onrender.com/signup', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(this.signup)
            });
        
            const data = await res.json(); 
            this.message = data.message; // Display success or error message from backend
        
            // Clear fields after success
            if (data.message === "Signup successful") {
                this.signup = { fullName: '', email: '', password: '' };
            }
        },

        async loginUser() {
            if (!this.login.email || !this.login.password) {
                this.message = "Please fill in all fields";
                return;
            }

            const res = await fetch('https://pingd-backend.onrender.com/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(this.login)
            });

            const data = await res.json();
            this.message = data.message;
            
            if (data.message === "Login successful") {
                this.currentUser = data.user; // store user info in app state for session 
        
                this.login = { email: '', password: '' }; // clear login fields after successful login
        
                this.mode = 'home'; // switch to home/dashboard 
                
                await this.fetchDineInRestaurants(); // load restaurant list for dashboard

                await this.fetchUserQueues(); // fetch user's current queues to show in dashboard
            }
            this.getQueueStatus(); // load queue status on login
        },

        logout() {
            if (confirm("Are you sure you want to logout?")) {
                this.currentUser = null;
                this.mode = 'login';

                this.userQueues = [];
                this.selectedQueue = null;
                this.queueStatus = null;
                this.queuePosition = null;
            }
        },

        // collects data from user to join queue, then calls joinQueue to send data to backend and update UI
        async joinQueuePrompt(restaurantId, queueType) {

            console.log("JOIN CLICKED");
            console.log("restaurantId:", restaurantId);
            console.log("queueType:", queueType);

            const code = prompt("Enter queue code from restaurant:");
            if (!code) return;
        
            if (queueType === "dine-in") {

                const partySize = prompt("Enter number of people:");
            
                if (!partySize || isNaN(partySize) || partySize <= 0) {
                    alert("Invalid party size");
                    return;
                }
            
                this.partySize = parseInt(partySize);
            
            } else {
                this.partySize = 1; // force party size to 1 for takeaway
            }
            
            this.queueCode = parseInt(code); 
        
            if (queueType === "dine-in") {
                this.joinDineInQueue(restaurantId); // call separate function for dine-in 
            } else {
                this.joinTakeawayQueue(restaurantId); // call separate function for takeaway 
            }
        },

        async joinDineInQueue(restaurantId) { // separate function for joining dine-in queue with party size input and validation
            try {

                const queueRes = await fetch('https://pingd-backend.onrender.com/getOrCreateQueue', { // first get or create the queue for this restaurant 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        restaurantID: restaurantId,
                        queueType: "dine-in" 
                    })
                });
        
                const queue = await queueRes.json(); // get the queue data from response
                console.log("Queue retrieved:", queue);
        
                const res = await fetch('https://pingd-backend.onrender.com/addToQueue', { // add user to that queue with party size and code
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        queueId: queue._id,
                        email: this.currentUser.email,
                        partySize: this.partySize,
                        queueCode: this.queueCode // pass code entered by user
                    })
                });
        
                const data = await res.json();

                if (data.message === "Invalid queue code") {
                    alert("Invalid code. Please try again.");
                    return;
                }
                else if (data.message === "User already in queue") {
                    alert("You are already in this queue.");
                    return;
                }
                else{
                    alert("Joined queue successfully!");
                }                
                
                console.log("Joined queue:", data);
                this.message = "Joined queue successfully!";

                await this.refreshQueueSummaries(); // refresh summaries to update queue size and wait time after joining
                await this.fetchUserQueues(); // refresh user's queues to show the new queue they just joined
        
            } catch (error) {
                console.error(error);
            }
        },

        async joinTakeawayQueue(restaurantId) { 
            try {
        
                this.partySize = 1;
        
                const queueRes = await fetch('https://pingd-backend.onrender.com/getOrCreateQueue', { // first get or create the queue for this restaurant
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        restaurantID: restaurantId,
                        queueType: "takeaway"
                    })
                });
        
                const queue = await queueRes.json(); // get the queue data from response
                console.log("Takeaway Queue:", queue);
        
                const res = await fetch('https://pingd-backend.onrender.com/addToQueue', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        queueId: queue._id,
                        email: this.currentUser.email,
                        partySize: 1, // always 1 for takeaway
                        queueCode: this.queueCode
                    })
                });
        
                const data = await res.json(); // get response data ( containing success or error msg)
        
                if (data.message === "Invalid queue code") {
                    alert("Invalid code. Please try again.");
                    return;
                }
                else if (data.message === "User already in queue") {
                    alert("You are already in this queue.");
                    return;
                }
                else {
                    alert("Joined takeaway queue!");
                }
        
                await this.fetchUserQueues(); // refresh user's queues to show the new takeaway queue they just joined
                await this.fetchTakeawayRestaurants(); // refresh takeaway list to update queue summaries after joining
        
            } catch (error) {
                console.error(error);
            }
        },
        
        async getQueueSummary(restaurantId) {
            try {
                const res = await fetch(`https://pingd-backend.onrender.com/queueSummary/${restaurantId}`);
                const data = await res.json();
        
                return data;
        
            } catch (error) {
                console.error(error);
                return { queueSize: 0, estimatedWaitTime: 0 };
            }
        },
        async getQueueStatus() {
            try {
                const response = await fetch(`https://pingd-backend.onrender.com/getQueueEntry/${this.currentUser._id}`);
                const data = await response.json(); 
        
                // if user is in queue, show position and status, otherwise show not in queue
                if (data) {
                    this.queuePosition = data.position;
                    this.queueStatus = data.status;
                    this.partySize = data.partySize;
                    this.estimatedWaitTime = data.estimatedWaitTime;
                } else {
                    this.partySize = null;
                    this.queuePosition = "Not in queue"; 
                    this.queueStatus = "Not in queue";
                    this.estimatedWaitTime = "Not in queue";
                }
        
            } catch (error) {
                console.error(error);
                this.queueStatus = "Error loading queue";
            }
        },

        async fetchUserQueues() { // fetch all queues the user is currently in 

            if (this.isFetchingQueues) return; // to prevent overlap 
            this.isFetchingQueues = true; // set flag show fetch in progress
        
            try {
                const res = await fetch(`https://pingd-backend.onrender.com/userQueues/${this.currentUser._id}`);
                const data = await res.json();
        
                this.userQueues = data; // store in app state 

                // update selectedQueue if user is viewing one
                if (this.selectedQueue) {
                    this.selectedQueue = this.userQueues.find(
                        q => q.queueId === this.selectedQueue.queueId
                    );
                }

                if (this.selectedQueue && this.selectedQueue.status === 'ready' && !this.readyHandled) { 

                    if (this.selectedQueue.queueType === 'takeaway') {
                        this.handleTakeawayReady(this.selectedQueue.queueId);
                    }
                }
        
            } catch (error) {
                console.error(error);
            }
        
            this.isFetchingQueues = false;
        },

        async leaveQueue(queueId) { // for dine-in and takeaway (use the same function but call different endpoints based on queue type) 
            try {
        
                const queue = this.userQueues.find(q => q.queueId === queueId);
        
                let endpoint = 'https://pingd-backend.onrender.com/leaveQueue'; // default for dine-in
        
                if (queue && queue.queueType === "takeaway") { // if takeaway queue, use the takeaway endpoint
                    endpoint = 'https://pingd-backend.onrender.com/leaveTakeawayQueue';
                }
        
                const response = await fetch(endpoint, { // pass the correct endpoint based on queue type
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: this.currentUser._id,
                        queueId: queueId
                    })
                });
        
                const data = await response.json();
                console.log(data);
        
                await this.fetchUserQueues();
                await this.fetchTakeawayRestaurants(); 
        
                this.mode = 'myQueue';
        
            } catch (error) {
                console.error(error);
            }
        },

        async acceptTable(queueId) { // user accepts table when notified, update status in backend, refresh data to update UI and show new status
            try {
                const response = await fetch('https://pingd-backend.onrender.com/acceptTable', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: this.currentUser._id,
                        queueId: queueId
                    })
                });

                const data = await response.json();
                console.log(data);
                console.log("API done");

                this.acceptTableMessage = data.message;

                await this.fetchUserQueues(); // refresh queues (get updated status and position after accepting)
                console.log("FETCHED QUEUES DONE");

                this.selectedQueue = null; // clear selected queue (prevent stale data issues)

                this.mode = 'myQueue'; // switch to myQueue view, show updated status in the queue list
                console.log("MODE SHOULD BE myQueue:", this.mode); // debug log to confirm mode switch

            } catch (error) {
                console.error(error);
                this.acceptTableMessage = "Error accepting table";
            }
        },

        /*async forceReady(queueId) { // used for testing (simulation)
            try {
                await fetch('http://localhost:3000/notifyCustomer', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        queueId: queueId,
                        userId: this.currentUser._id
                    })
                });
        
                await this.fetchUserQueues();

                const updatedQueue = this.userQueues.find(q => q.queueId == queueId);

                // 🛑 SAFE CHECK (this prevents crash)
                if (updatedQueue) {
                    this.selectedQueue = updatedQueue;
                }
        
            } catch (error) {
                console.error(error);
            }
        },*/
        
        async waitLonger(queueId) {
            try {
                const response = await fetch('https://pingd-backend.onrender.com/waitLonger', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: this.currentUser._id,
                        queueId: queueId
                    })
                });
        
                const data = await response.json();
                console.log(data);
                this.waitLongerMessage = data.message;
        
                if (this.selectedQueue) { 
                    this.selectedQueue.status = "delayed"; // update status immediately
                }
        
                await this.fetchUserQueues();

                // update selected queue after data refresh for UI to show latest status
                const updated = this.userQueues.find(q => q.queueId == queueId);
                if (updated) {
                    this.selectedQueue = updated;
                }
                await this.refreshQueueSummaries();

                // manually set selected queue to update UI immediately ( no waiting for next periodic refresh)
                this.selectedQueue = this.userQueues.find(q => q._id === queueId);
        
            } catch (error) {
                console.error(error);
                this.waitLongerMessage = "Error updating request";
            }
        },
        
        async forfeitTable(queueId) {
            try {
                await fetch('https://pingd-backend.onrender.com/forfeit', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: this.currentUser._id,
                        queueId: queueId
                    })
                });
        
                await this.fetchUserQueues();
        
                this.selectedQueue = null;
                this.mode = 'myQueue';
        
            } catch (error) {
                console.error(error);
            }
        },

        // fetch dine-in restaurants to display UI
        async fetchDineInRestaurants() {
            try {
                const response = await fetch('https://pingd-backend.onrender.com/restaurants/dinein');
                const data = await response.json();
                this.restaurants = data;

                for (let r of this.restaurants) { // fetch queue summaries for each restaurant (queue size and wait time in restaurant cards)
                    const summary = await this.getQueueSummary(r.restaurant_id);
                    this.$set(this.queueSummaries, r.restaurant_id, summary);
                }
            } catch (error) {
                console.error(error);
            }
        },

        async fetchTakeawayRestaurants() {
            try {
                const res = await fetch('https://pingd-backend.onrender.com/takeawayWithQueue');
                const data = await res.json();
        
                this.takeawayRestaurants = data.map(r => {
                
                    return {
                        ...r, // spread operator: keep all existing restaurant data (name, cuisine, rating, etc)
                        cleanId: r.restaurant_id 
                    };
                });
        
            } catch (error) {
                console.error(error);
            }
        },

        openTakeaway() {
            this.mode = 'browseTakeout';
            this.fetchTakeawayRestaurants();
        },

        confirmPickup(queueId) {
            alert("Please proceed to the counter to collect your order.");
            this.mode = 'myQueue';
        },

        async handleTakeawayReady(queueId) {

            alert("Your order is ready! Please proceed to the counter to collect it.");
        
            try {
                await fetch('https://pingd-backend.onrender.com/leaveTakeawayQueue', { 
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: this.currentUser._id,
                        queueId: queueId
                    })
                });
        
                this.selectedQueue = null; // clear selected queue to prevent stale data issues after leaving 
        
                await this.fetchUserQueues();
                await this.fetchTakeawayRestaurants(); 
        
                this.mode = 'myQueue';
        
                this.readyHandled = false;
        
            } catch (error) {
                console.error(error);
            }
        },

        async refreshQueueSummaries() { // refresh queue summaries for all restaurants
            for (let r of this.restaurants) {
                const summary = await this.getQueueSummary(r.restaurant_id);
                this.$set(this.queueSummaries, r.restaurant_id, summary);
            }
        },

        async loadRestaurantData(id) { // helper function to load menu, trending and recommendations for a restaurant by id
            try {

                // menu
                const res = await fetch(`https://pingd-backend.onrender.com/menu/${id}`);
                this.menuItems = await res.json();
        
                // trending
                const trendRes = await fetch(`https://pingd-backend.onrender.com/menu/${id}/trending`);
                this.trendingItems = await trendRes.json();
        
                // recommendations
                const recRes = await fetch(`https://pingd-backend.onrender.com/recommendations/restaurants/${id}`);
                this.recommendedRestaurants = await recRes.json();
        
            } catch (error) {
                console.error(error);
            }
        },

        async viewRestaurant(restaurant) {
            this.selectedRestaurant = restaurant;
            this.mode = 'menu';
        
            const id = restaurant.restaurant_id;
        
            await this.loadRestaurantData(id); 
        },


        openQueue(queue) {
            this.selectedQueue = queue;
            this.mode = 'queueDetail';

            this.startCountdown(); // start countdown timer for this queue

            if (queue.queueType === 'dine-in') {
                this.loadRestaurantData(queue.restaurantID); // load menu items for this restaurant so we can show them in the queue detail view while they wait
            }
        },

        startCountdown() {

            console.log("startCountdown called");
        
            // safety checks to prevent errors and ensure have the right data to calculate countdown
            if (!this.selectedQueue) {
                console.log("No selectedQueue");
                return;
            }
        
            if (this.selectedQueue.estimatedWaitTime == null) {
                console.log("No estimatedWaitTime");
                return;
            }
        
            if (this.timer) {
                console.log("Clearing existing timer");
                clearInterval(this.timer);
                this.timer = null;
            }
        
            const now = Date.now();
            console.log("Current time:", new Date(now));
        
            console.log("selectedQueue.updatedAt:", this.selectedQueue.updatedAt); // check the value of updatedAt before parsing
        
            const updatedTime = new Date(this.selectedQueue.updatedAt).getTime();
            console.log("Updated time (parsed):", new Date(updatedTime));
        
            const elapsedMs = now - updatedTime; // current time minus the time when the queue was last updated (when they joined or when status changed)
            const elapsedMinutes = Math.floor(elapsedMs / 60000); // convert elapsed time to minutes
        
            console.log("Elapsed ms:", elapsedMs);
            console.log("Elapsed minutes:", elapsedMinutes);
        
            const originalEWT = Number(this.selectedQueue.estimatedWaitTime);
            console.log("Original EWT:", originalEWT);
        
            const remaining = originalEWT - elapsedMinutes;
            console.log("Remaining before clamp:", remaining);
        
            this.countdownTime = remaining > 0 ? remaining : 0; // ensure countdown doesn't go negative
        
            console.log("Final countdownTime:", this.countdownTime);
        
            if (this.countdownTime <= 0) {
                console.log("Countdown already finished");
                return;
            }
        
            this.timer = setInterval(() => { // start a timer that ticks every minute to update the countdown time
                console.log("Tick... current countdown:", this.countdownTime);
        
                if (this.countdownTime > 0) {
                    this.countdownTime--;
                }
        
                if (this.countdownTime <= 0) {
                    console.log("Countdown finished");
                    clearInterval(this.timer);
                    this.timer = null;
                }
            }, 60000); // tick every minute
        },

        getRemainingTime(queue) { // used in index.html to show the dynamic countdown time 
            const updatedTime = new Date(queue.updatedAt);
            const now = new Date();
            const elapsed = Math.floor((now - updatedTime) / 60000);
            return Math.max(queue.estimatedWaitTime - elapsed, 0);
        },

        viewRestaurantByDish(item) { // used in index.html to allow user to click on a trending dish and view the restaurant menu
            const restaurant = this.restaurants.find(
                r => r.restaurant_id === item.restaurant_id
            );

            if (restaurant) {
                this.viewRestaurant(restaurant);
            }
        },

        selectBrowse(type) { // used to choose which restaurant type to browse
            this.showBrowseModal = false;

            if (type === 'dine-in') {
                this.mode = 'browse';
            } else {
                this.openTakeaway();
            }
        },

        setFilter(type) { // allows user to filter dine-in restaurants by wait time or rating 
            this.activeFilter = type;
        
            if (type === 'waitTime') {
                this.sortOption = 'waitTime';
            } else if (type === 'rating') {
                this.sortOption = 'rating';
            } else {
                this.sortOption = '';
            }
        },

        setTakeawayFilter(type) { // same as above but for takeaway section
            this.takeawayFilter = type;
        
            if (type === 'waitTime') {
                this.takeawaySortOption = 'waitTime';
            } 
            else if (type === 'rating') {
                this.takeawaySortOption = 'rating';
            } 
            else {
                this.takeawaySortOption = '';
            }
        },

        formatTakeawayCuisine(categories) { // for displaying in takeaway browse lists
            if (!categories) return '';
        
            if (Array.isArray(categories)) {
                return categories.slice(0, 2).join(' • ');
            }
        
            return categories;
        },

        getTakeawayCuisineImage(categories) { // map cuisine types to images for takeaway section 
            if (!categories) return 'https://pingd-backend.onrender.com/static/images/other.png';
        
            const type = Array.isArray(categories) ? categories[0] : categories;
        
            const key = type.toLowerCase().trim();
        
            const map = {
                "fast food": "american",
                "burgers": "american",
                "sandwiches": "american",
                "american": "american",
                "pizza": "italian",
        
                "coffee": "cafe",
                "beverages": "cafe",
                "cafe": "cafe",
        
                "dessert": "bakery",
                "desserts": "bakery",
                "cakes": "bakery",
                "sweets": "bakery",
        
                "indian": "indian",
                "pakistani": "indian",
                "biryani": "indian",
        
                "chinese": "chinese",
                "italian": "italian",
                "japanese": "japanese",
                "mexican": "mexican",
                "thai": "thai",
                "seafood": "seafood",
        
                "arabic": "middleeastern",
                "middle eastern": "middleeastern",
        
                "breakfast": "bakery",
                "salads": "other",
                "snacks": "other"
            };
        
            const mapped = map[key] || 'other';
        
            return `https://pingd-backend.onrender.com/static/images/${mapped}.png`;
        },

        getDashboardCuisineImage(q) { // helper function to get cuisine image for a queue 

            let categories = q.categories;

            if(!categories) { 
                categories = this.getCuisine(q.restaurantID);
            }

            if(!categories) { // if still no categories, return default image
                return 'https://pingd-backend.onrender.com/static/images/other.png';
            }

            return q.queueType === 'takeaway' // if takeaway queue, use the takeaway cuisine image mapping 
                ? this.getTakeawayCuisineImage(categories) 
                : this.getCuisineImage(categories);
        },

        getCuisineImage(cuisine) { // helper function to return cuisine image based on cuisine type
            const images = {
                "Indian": "https://pingd-backend.onrender.com/static/images/indian.png",
                "Cafe": "https://pingd-backend.onrender.com/static/images/cafe.png",
                "Japanese": "https://pingd-backend.onrender.com/static/images/japanese.png",
                "American": "https://pingd-backend.onrender.com/static/images/american.png",
                "Middle Eastern": "https://pingd-backend.onrender.com/static/images/middleeastern.png",
                "Italian": "https://pingd-backend.onrender.com/static/images/italian.png",
                "Mexican": "https://pingd-backend.onrender.com/static/images/mexican.png",
                "Chinese": "https://pingd-backend.onrender.com/static/images/chinese.png",
                "Thai": "https://pingd-backend.onrender.com/static/images/thai.png",
                "Bakery": "https://pingd-backend.onrender.com/static/images/bakery.png",
                "Seafood": "https://pingd-backend.onrender.com/static/images/seafood.png",
                "Other": "https://pingd-backend.onrender.com/static/images/other.png"
            };
        
            return images[cuisine] || "/static/images/other.png"; // return default image if cuisine type not recognized
        },

        getCuisineBanner(cuisine) { // similar to above but for banner images in restaurant detail view 
            const banners = {
                "Indian": "https://pingd-backend.onrender.com/static/images/indian_banner.png",
                "Cafe": "https://pingd-backend.onrender.com/static/images/cafe_banner.png",
                "Japanese": "https://pingd-backend.onrender.com/static/images/japanese_banner.png",
                "American": "https://pingd-backend.onrender.com/static/images/american_banner.png",
                "Middle Eastern": "https://pingd-backend.onrender.com/static/images/middleeastern_banner.png",
                "Italian": "https://pingd-backend.onrender.com/static/images/italian_banner.png",
                "Mexican": "https://pingd-backend.onrender.com/static/images/mexican_banner.png",
                "Chinese": "https://pingd-backend.onrender.com/static/images/chinese_banner.png",
                "Thai": "https://pingd-backend.onrender.com/static/images/thai_banner.png",
                "Bakery": "https://pingd-backend.onrender.com/static/images/bakery_banner.png",
                "Seafood": "https://pingd-backend.onrender.com/static/images/seafood_banner.png",
                "Other": "https://pingd-backend.onrender.com/static/images/other_banner.png"
            };
        
            return banners[cuisine] || "https://pingd-backend.onrender.com/static/images/other_banner.png";
        },

        getCuisine(restaurantID) {
            const r = this.restaurants.find(r => r.restaurant_id === restaurantID);
            return r ? r.categories : "Other";
        },

        getProgressWidth(queue) { // helper function to calculate progress bar width based on estimated wait time and remaining countdown time
            if (!queue || !queue.updatedAt || !queue.estimatedWaitTime) {
                return '0%';
            }
        
            // handle status cases
            if (queue.status === 'ready') {
                return '100%'; // fully complete 
            }
        
            if (queue.status === 'accepted') {
                return '100%';
            }
        
            if (queue.status === 'delayed') {
                return '70%'; // show some progress but indicate delay 
            }
        
            const updatedTime = new Date(queue.updatedAt).getTime();
            const now = Date.now();
        
            const elapsedMs = now - updatedTime;
            const elapsedMinutes = elapsedMs / 60000;
        
            const total = Number(queue.estimatedWaitTime);
        
            const progress = (elapsedMinutes / total) * 100;
        
            return Math.max(0, Math.min(progress, 100)) + '%';
        },

        getStatusClass(status) { // for queue details pg to show different status styles based on the queue status value
            if (!status) return '';
        
            const s = String(status).toLowerCase();
        
            if (s === 'waiting') return 'status-waiting';
            if (s === 'ready') return 'status-ready';
            if (s === 'delayed') return 'status-delayed';
            if (s === 'accepted') return 'status-accepted';
        
            return '';
        },

        getProfileAvatar() {
            return 'https://pingd-backend.onrender.com/static/images/default-avatar.png';
        },

        toggleFAQ(index) {
            this.faqs.forEach((f, i) => {
                f.open = i === index ? !f.open : false;
            });
        }

    },
    computed: {
        filteredRestaurants() {
            let result = this.restaurants;
        
            // Search
            if (this.searchTerm) {
                result = result.filter(r => {
                    const name = r.brand_name ? r.brand_name.toString().toLowerCase() : '';
                    return name.includes(this.searchTerm.toLowerCase());
                });
            }
        
            // Filter by cuisine
            if (this.selectedCuisine) {
                result = result.filter(r => r.categories === this.selectedCuisine);
            }
        
            // Sort by rating
            if (this.sortOption === "rating") {
                result = result.sort((a, b) => b.rating - a.rating);
            }

            // Sort by wait time 
            if (this.sortOption === "waitTime") {
                result.sort((a, b) => {
                    const waitA = this.queueSummaries[a.restaurant_id]?.estimatedWaitTime || 0;
                    const waitB = this.queueSummaries[b.restaurant_id]?.estimatedWaitTime || 0;

                    return waitA - waitB; // smallest first
                });
            }
        
            return result;
        },

        cuisines(){
            return [...new Set(this.restaurants.map(r => r.categories))].filter(c => c); // get unique cuisines, filter out null/undefined
        },

        filteredTakeawayRestaurants() {
            let result = [...this.takeawayRestaurants];
        
            // Search
            if (this.takeawaySearch) {
                result = result.filter(r =>
                    r.brand_name.toLowerCase().includes(this.takeawaySearch.toLowerCase())
                );
            }
        
            // Cuisine
            if (this.takeawayCuisine) {
                result = result.filter(r => r.categories === this.takeawayCuisine);
            }
        
            // Rating
            if (this.takeawaySortOption === "rating") {
                result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            }
        
            // Wait time
            if (this.takeawaySortOption === "waitTime") {
                result.sort((a, b) =>
                    (a.estimatedWaitTime || 0) - (b.estimatedWaitTime || 0)
                );
            }
        
            return result;
        },

        trendingRestaurants() { // get top 5 dine-in restaurants with longest queues for trending section on homepage
            return (this.restaurants || []) 
                .map(r => ({
                    ...r,
                    queueLength: this.queueSummaries[r.restaurant_id]?.queueLength || 0, 
                    estimatedWaitTime: this.queueSummaries[r.restaurant_id]?.estimatedWaitTime || 0
                }))
                .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                .slice(0, 5); 
        },

        recentRestaurants() { // get top 5 restaurants the user is currently in queue for to show on dashboard
            return (this.userQueues || []).slice(0, 5);
        },

        recommendedDishes() { // get top 5 trending menu items from the most recent restaurant the user is in queue for 

            if (!this.recentRestaurants || this.recentRestaurants.length === 0) {
                return []; // if no recent restaurants, return empty
            }
         
            const recent = this.recentRestaurants[0]; // most recent one
        
            return (this.trendingItems || []).slice(0, 5); // use trending items already loaded
        }
    },
    mounted() { 
        setInterval(() => { 
            if (this.currentUser) {
                this.getQueueStatus();
                this.fetchUserQueues();
                this.fetchDineInRestaurants();
            }
        }, 3000); // every 3 sec
        this.fetchDineInRestaurants(); // load restaurant list on app start

        // periodic UI refresh to update countdown timers without needing to wait for API calls (too slow)
        this.uiTimer = setInterval(() => {
            this.$forceUpdate();
        }, 1000);
    }
});
