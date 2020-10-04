const path = require("path")
const ErrorResponse = require("../utils/errorResponse")
const asyncHandler = require("../middleware/async")
const geocoder = require("../utils/geocoder")
const Bootcamp = require("../models/Bootcamp")

//@desc get all bootcamps
//@route GET /api/v1/bootcamps
//@access Public
exports.getBootcamps = asyncHandler(async (req, res, next) => {
        res
            .status(200)
            .json(res.advancedResults)
})

//@desc get all bootcamps
//@route GET /api/v1/bootcamps/:id
//@access Public
exports.getBootcamp = asyncHandler(async (req, res, next) => {
        const bootcamp = await Bootcamp.findById(req.params.id)

        if (!bootcamp) {
            return next(new ErrorResponse(`Bootcamp not found with ${req.params.id}`, 404))
        }

        res.status(200).json({success:true, data: bootcamp})
})

//@desc Create new
//@route POST /api/v1/bootcamps
//@access Private
exports.createBootcamp = asyncHandler(async (req, res, next) => {
        req.body.user = req.user.id

        const publishedBootcamp = await Bootcamp.findOne({user: req.user.id})

        if (publishedBootcamp && req.user.role!=="admin") {
            return next(new ErrorResponse(`${req.user.id} already published`, 400))
        }

        const bootcamp = await Bootcamp.create(req.body)

        res.status(201).json({
            success: true,
            data: bootcamp
        })
})

//@desc Update
//@route PUT /api/v1/bootcamps/:id
//@access Private
exports.updateBootcamp = asyncHandler(async (req, res, next) => {
     let bootcamp = await Bootcamp.findById(req.params.id)

    if (!bootcamp){
        return next(new ErrorResponse(`Bootcamp not found with ${req.params.id}`, 404))
    }

    if (bootcamp.user.toString() !== req.user.id && req.user.role !== "admin") {
        return next(new ErrorResponse(`${req.user.id} can't update this bootcamp`, 401))
    }

    bootcamp = await Bootcamp.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    })

    res.status(200).json({success:true, data: bootcamp})
})

//@desc Delete
//@route DELETE /api/v1/bootcamps
//@access Private
exports.deleteBootcamp = asyncHandler(async (req, res, next) => {
        const bootcamp = await Bootcamp.findById(req.params.id)

        if (!bootcamp){
            return next(new ErrorResponse(`Bootcamp not found with ${req.params.id}`, 404))
        }

    if (bootcamp.user.toString() !== req.user.id && req.user.role !== "admin") {
        return next(new ErrorResponse(`${req.user.id} can't delete this bootcamp`, 401))
    }

        bootcamp.remove()

        res.status(200).json({success:true, data: {}})
})

exports.getBootcampsInRadius = asyncHandler(async (req, res, next) => {
    const {zipcode, distance} = req.params

    const loc = await geocoder.geocode(zipcode)
    const lat = loc[0].latitude
    const lng = loc[0].longitude

    const radius = distance / 3963

    const bootcamps = await Bootcamp.find({
        location: {$geoWithin: { $centerSphere: [ [ lng, lat ], radius ] }
}
    })

    res.status(200).json({
        success: true,
        count: bootcamps.length,
        data: bootcamps
    })
})


exports.bootcampPhotoUpload = asyncHandler(async (req, res, next) => {
    const bootcamp = await Bootcamp.findById(req.params.id)

    if (!bootcamp){
        return next(new ErrorResponse(`Bootcamp not found with ${req.params.id}`, 404))
    }

    if (bootcamp.user.toString() !== req.user.id && req.user.role !== "admin") {
        return next(new ErrorResponse(`${req.user.id} can't load photo to this bootcamp`, 401))
    }

    if (!req.files){
        return next(new ErrorResponse(`Upload file`, 400))
    }

    const file = req.files.file

    if (!file.mimetype.startsWith("image")){
        return next(new ErrorResponse(`Upload image file`, 400))
    }

    if (file.size>process.env.MAX_FILE_UPLOAD){
        return next(new ErrorResponse(`Upload image less that ${process.env.MAX_FILE_UPLOAD}`, 400))
    }

    file.name = `photo_${bootcamp._id}${path.parse(file.name).ext}`

    file.mv(`${process.env.FILE_UPLOAD_PATH}/${file.name}`, async err => {
        if (err){
            return next(new ErrorResponse(`Problem with file`, 500))
        }

        await Bootcamp.findByIdAndUpdate(req.params.id, {photo: file.name})
    })

    res.status(200).json({
        status:true,
        data:file.name
    })
})
