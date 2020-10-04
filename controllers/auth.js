const crypto = require("crypto")
const ErrorResponse = require("../utils/errorResponse")
const asyncHandler = require("../middleware/async")
const sendEmail = require("../utils/sendEmail")
const User = require("../models/User")

exports.register = asyncHandler(async (req, res, next)=>{
    const {name, email, password, role} = req.body;

    const user = await User.create({
        name, email, password, role
    })

    const token = user.getSignedJwtToken()

    res.status(200).json({
        success: true,
        token
    })
})


exports.login = asyncHandler(async (req, res, next)=>{
    const {email, password} = req.body;

    if (!email || !password){
        return next(new ErrorResponse("Email and password", 400))
    }

    const user = await User.findOne({email}).select("+password")

    if (!user){
        return next(new ErrorResponse("Invalid credentials", 401))
    }

    const isMatch = await user.matchPassword(password)

    if (!isMatch){
        return next(new ErrorResponse("Invalid credentials", 401))
    }

    sendTokenResponce(user, 200, res)
})

const sendTokenResponce = (user, statusCode, res) => {
    const token = user.getSignedJwtToken()

    const options = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
        httpOnly: true
    }

    if (process.env.NODE_ENV === "production"){
        options.secure = true
    }

    res
        .status(statusCode)
        .cookie("token", token, options)
        .json({
            success:true,
            token
        })
}

exports.getMe = asyncHandler(async (req,res,next)=>{
    const user = await User.findById(req.user.id)

    res
        .status(200)
        .json({
        success:true,
        data:user
    })
})

exports.updateDetails = asyncHandler(async (req,res,next)=>{
    const fieldsToUpdate = {
        name: req.body.name,
        email: req.body.email,
    }

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
        new: true,
        runValidators: true
    })

    res
        .status(200)
        .json({
            success:true,
            data:user
        })
})

exports.resetPassword = asyncHandler(async (req,res,next)=>{
    const resetPasswordToken = crypto.createHash("sha256").update(req.params.resettoken).digest("hex")

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: {$gt: Date.now()}
    })

    if (!user) {
        return next(new ErrorResponse("Invalid token", 400))
    }

    user.password = req.body.password
    user.resetPasswordToken = undefined
    user.resetPasswordExpire = undefined

    await user.save()

    sendTokenResponce(user, 200, res)
})

exports.forgotPassword = asyncHandler(async (req,res,next)=>{
    const user = await User.findOne({email: req.body.email})

    if (!user){
        return next(new ErrorResponse("No such user", 404))
    }

    const resetToken = user.getResetPasswordToken();

    await user.save({validateBeforeSave: false})

    const resetUrl = `${req.protocol}://${req.get("host")}/api/v1/auth/resetpassword/${resetToken}`

    const message = `\n\n ${resetUrl}`

    try {
        await sendEmail({
            email: user.email,
            subject: "Password reset token",
            message
        })

        res
            .status(200)
            .json({
                success:true,
                data:"Email sent"
            })
    } catch (e) {
        user.resetPasswordToken = undefined
        user.resetPasswordExpire = undefined
        await user.save({validateBeforeSave: false})

        return next(new ErrorResponse("Email can't be sent", 500))

    }

    res
        .status(200)
        .json({
            success:true,
            data:user
        })
})


exports.updatePassword = asyncHandler(async (req,res,next)=>{
    const user = await User.findById(req.user.id).select("+password")

    if (!(await user.matchPassword(req.body.currentPassword))) {
        return next(new ErrorResponse("Incorrect password", 401))
    }

    user.password = req.body.newPassword;
    await user.save()

    sendTokenResponce(user, 200, res)
})

exports.logout = asyncHandler(async (req,res,next)=>{
    res.cookie("token", "none", {
        expires: new Date(Date.now()+10*1000),
        httpOnly: true
    })

    res
        .status(200)
        .json({
            success:true,
            data:{}
        })
})
