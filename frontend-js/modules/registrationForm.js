import axios from 'axios';


export default class RegistrationForm {
    constructor() {
        this._csrf = document.querySelector('[name="_csrf"]').value;
        this.form = document.querySelector("#registration-form");
        this.allFields = document.querySelectorAll("#registration-form .form-control");
        this.insertValidationElements();
        this.username = document.querySelector("#username-register");
        this.username.previousValue = "";
        this.email = document.querySelector("#email-register");
        this.email.previousValue = "";
        this.password = document.querySelector("#password-register");
        this.password.previousValue = "";
        this.username.isUnique = false;
        this.email.isUnique = false;
        this.events();
    }


    //events
    events() {
        this.form.addEventListener("submit", e =>{
            e.preventDefault();
            this.formSubmitHandler();
        })
        this.username.addEventListener("keyup", () => {
            this.isDifferent(this.username, this.usernameHandler);
        });
        this.email.addEventListener("keyup", () => {
           this.isDifferent(this.email, this.emailHandler);
        });
        this.password.addEventListener("keyup", () => {
            this.isDifferent(this.password, this.passwordHandler);
         });
         this.username.addEventListener("blur", () => {
            this.isDifferent(this.username, this.usernameHandler);
        });
        this.email.addEventListener("blur", () => {
           this.isDifferent(this.email, this.emailHandler);
        });
        this.password.addEventListener("blur", () => {
            this.isDifferent(this.password, this.passwordHandler);
         });
    }

    //methods
    formSubmitHandler() {
        this.usernameImmediate();
        this.usernameAfterDelay();
        this.emailAfterDelay();
        this.passwordImmediate();
        this.passwordAfterDelay();

        if (
            this.username.isUnique &&
            !this.username.errors &&
            this.email.isUnique &&
            !this.email.errors &&
            !this.password.errors
            ) {
                this.form.submit();
            }
    }
    usernameHandler() {
        this.username.errors = false;
        this.usernameImmediate();
        clearTimeout(this.username.timer);
        this.username.timer = setTimeout(() => {
            this.usernameAfterDelay()
        }, 800);
    }
    passwordHandler() {
        this.password.errors = false;
        this.passwordImmediate();
        clearTimeout(this.password.timer);
        this.password.timer = setTimeout(() => {
            this.passwordAfterDelay()
        }, 800);
    }
    passwordImmediate() {
        if (this.password.value.length>50) {
            this.showValidationError(this.password, "Password cannot exceed 50 characters.");
        }
        if (!this.password.errors) {
            this.hideValidationError(this.password);
        }
    }
    passwordAfterDelay(){
        if(this.password.value.length <12) {
            this.showValidationError(this.password, "Password must be at least 12 characters long.");
        }
    }
    usernameImmediate() {
        if (this.username.value != "" && !/^([a-zA-Z0-9]+)$/.test(this.username.value)) {
           this.showValidationError(this.username, "Username can only contain letters and numbers");
        }
        if (this.username.value.length > 30) {
            this.showValidationError(this.username, "Username cannot be longer than 30 characters")
            }
        if (!this.username.errors) {
            this.hideValidationError(this.username);
        }
    }
    emailHandler() {
        this.email.errors = false;
        
        clearTimeout(this.email.timer);
        this.email.timer = setTimeout(() => {
            this.emailAfterDelay()
        }, 800);
    }
    hideValidationError(ele) {
        ele.nextElementSibling.classList.remove("liveValidateMessage--visible");
    }
    showValidationError(ele, message){
        ele.nextElementSibling.innerHTML = message;
        ele.nextElementSibling.classList.add("liveValidateMessage--visible");
        ele.errors = true;
    }
    emailAfterDelay(){
        if (!/^\S+@\S+$/.test(this.email.value)) {
            this.showValidationError(this.email, "Please provide a valide email address");
        }
        if(!this.email.errors) {
            axios.post('/doesEmailExist', {_csrf: this._csrf, email:this.email.value}).then((response)=>{
                if (response.data) {
                    this.email.isUnique = false;
                    this.showValidationError(this.email, "That email address is already in use.");
                } else {
                    this.email.isUnique = true;
                    this.hideValidationError(this.email);
                }
            }).catch(()=>{
                console.log("please try again later");
            })
        }
    }
    usernameAfterDelay(){
        //alert("delayed content");
        if (this.username.value.length <3) {
            this.showValidationError(this.username, "Username must be at least 3 characters.")

        }
        if (!this.username.errors) {
            axios.post('/doesUsernameExist',{_csrf: this._csrf, username: this.username.value}).then((response)=>{
                if(response.data) {
                    this.showValidationError(this.username, "That username is already in use.");
                    this.username.isUnique = false;
                } else {
                    this.username.isUnique = true;
                }
            }).catch(()=>{
                console.log("Please try again later.")
            })
        }
    }
    isDifferent(ele, handler) {
        if (ele.previousValue != ele.value) {
            handler.call(this);
        }
        ele.previousValue = ele.value;
    }
    insertValidationElements() {
        this.allFields.forEach(function(ele){
            ele.insertAdjacentHTML('afterend', '<div class="alert alert-danger small liveValidateMessage"></div>')
        })
    }

}