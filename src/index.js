const UUSI_SAKKO_USAGE = `
Käyttö:
    /uusi_sakko RIKOS;MÄÄRÄ;/KOMENTO
                        
Esimerkki:
    /uusi_sakko Iso feidaus;35;/feidi_iso
    
Sen jälkeen raportoi sakko:
    /feidi_iso eero`

const HISTORIA_USAGE = `
Käyttö:
    /historia HENKILÖ
`

export default {
    async fetch(req, env, ctx) {
        async function recordTort(env, tortName, criminalName) {
            try {
                const tort = await env.TORT.get(tortName, { type: 'json' })
                if (!tort) {
                    await respondInChat(`Nyt meni jotain pieleen. Sakkoa: "${tortName}" ei ole olemassa? Syyttäkää Mihkalia.`)
                    return
                }
                // fetch the data for the criminal
                let criminalData = await env.PERSON.get(criminalName, { type: 'json' })
                if (!criminalData) {
                    criminalData = { name: criminalName, torts: [], sum: 0 }
                }

                //update the criminal data
                criminalData.torts.push({ penalty: tort.penalty, description: tort.description, date: new Date().toUTCString() })
                criminalData.sum = Number(criminalData.sum) + Number(tort.penalty)

                // push the data
                env.PERSON.put(criminalName, JSON.stringify(criminalData))
                await respondInChat(huoh[Math.floor(Math.random() * huoh.length)])
            } catch (error) {
                await respondInChat(`Error: ${error}\nOpettelis vittu koodaan`)
                return
            }
        }

        // hard coded handlers. Every new tort gets an additional command added
        const commandHandlers = {
            '/sakkolista': async (env, args) => {
                // fetch the object metadata
                const { keys } = await env.TORT.list()

                // if empty, print that and exit
                if (keys.length === 0) {
                    await respondInChat('Sakkolista on tyhjä. Luo sakko komennolla:/uusi_sakko')
                    return
                }

                // fetch the actual objects
                const sakkolista = await Promise.all(
                    keys.map(async ({ name }) => {
                        const tort = await env.TORT.get(name, { type: 'json' })
                        return tort
                    })
                )

                // format the message
                const message =
                    'SAKKOLISTA:\n' +
                    sakkolista.map(({ command, description, penalty }) => `- ${description} ${penalty}€ (/${command})`).join('\n')

                await respondInChat(message)
            },

            '/uusi_sakko': async (env, args) => {
                // parse args
                let [description, penalty, command] = args.split(';')
                if (!description || !penalty || !command) {
                    await respondInChat(UUSI_SAKKO_USAGE)
                    return
                }
                penalty = Number(penalty.replace('€', ''))
                command = command.replace('/', '')

                if (isNaN(penalty)) {
                    await respondInChat(`"${penalty}" ei ole numero...`)
                    return
                }

                try {
                    await env.TORT.put(command, JSON.stringify({ description, penalty, command }))
                    await respondInChat('OK')
                } catch (error) {
                    await respondInChat(`Vittu se mihkal ei osaa koodaa: ${error}`)
                }
            },

            '/poista_sakko': async (env, args) => {
                const command = args
                if (!command) {
                    await respondInChat(usage)
                    return
                }

                try {
                    const sakko = await env.TORT.get(command)
                    if (!sakko) {
                        await respondInChat('Eioo tommosta')
                        return
                    }

                    await env.TORT.delete(command)
                    await respondInChat('OK')
                    return
                } catch (error) {
                    await respondInChat(`Vittu se mihkal ei osaa koodaa: ${error}`)
                }
            },

            // Prints person's tort history in full
            '/historia': async (env, args) => {
                try {
                    const name = args

                    if (!name) {
                        await respondInChat(HISTORIA_USAGE)
                        return
                    }

                    const person = await env.PERSON.get(name, { type: 'json' })

                    // format them nicely
                    const tortLog = person.torts.map(({ date, description, penalty }) => {
                        let dateFormatted
                        if (date) {
                            const dateObject = new Date(date)
                            const m = dateObject.getMonth() + 1 // my god this is horrible
                            const d = dateObject.getDate() + 1
                            // const y = dateObject.getFullYear()
                            dateFormatted = `${d}.${m}.`
                        } else {
                            dateFormatted = 'pvm puuttuu'
                        }
                        return `${dateFormatted} - ${description} ${penalty}€`
                    })

                    await respondInChat(`${name} sakkohistoria:\n\n` + tortLog.join('\n') + `\n\nYhteensä: ${person.sum}€`)
                    return
                } catch (error) {
                    await respondInChat(`Vittu se mihkal ei osaa koodaa: ${error}`)
                }
            },

            // Finds the person whos accrued most penalties
            '/goblin': async (env, args) => {
                const { keys } = await env.PERSON.list()
                const persons = await Promise.all(keys.map(async ({ name }) => await env.PERSON.get(name, { type: 'json' })))

                // find the winner
                const goblin = persons.reduce(
                    (candidate, { name, sum }) => {
                        return candidate.sum > sum ? candidate : { sum, name }
                    },
                    { sum: 0, name: null }
                )

                await respondInChat(`Eniten sakkoja on kerännyt...`)
                // wait 1sec for dramatic effect
                await new Promise((resolve) => {
                    setTimeout(resolve, 1000)
                })
                await respondInChat(`${goblin.name}! ${goblin.sum}€`)
            },

            // Finds the person who has committed most torts
            '/ahkerin': async (env, args) => {
                const { keys } = await env.PERSON.list()
                const persons = await Promise.all(keys.map(async ({ name }) => await env.PERSON.get(name, { type: 'json' })))

                // find the winner
                const goblin = persons.reduce(
                    (candidate, { name, torts }) => {
                        const numberOfTorts = torts.length
                        return candidate.numberOfTorts > numberOfTorts ? candidate : { numberOfTorts, name }
                    },
                    { numberOfTorts: 0, name: null }
                )

                await respondInChat(`Ahkerin rikollinen on...`)
                // wait 1sec for dramatic effect
                await new Promise((resolve) => {
                    setTimeout(resolve, 1000)
                })
                await respondInChat(`${goblin.name}! ${goblin.numberOfTorts} sakkoa`)
            },

            // näyttää yhteenvedon henkilön sakoista. Jos ei ole argumenttia tulostaa kaikkien summat
            '/sakot': async (env, args) => {
                // print everyone's sums
                if (!args) {
                    const { keys } = await env.PERSON.list()
                    const persons = await Promise.all(keys.map(async ({ name }) => await env.PERSON.get(name, { type: 'json' })))
                    await respondInChat(`Kaikkien sakot:\n\n` + persons.map(({ name, sum }) => `${name}: ${sum}€`).join('\n'))
                    return
                }

                // Parse an overview of a persons committed torts
                const name = args
                const person = await env.PERSON.get(name, { type: 'json' })

                // count how many each tort has been committed
                const tortOverview = person.torts.reduce((acc, { description, penalty }) => {
                    if (description in acc) {
                        acc[description].timesCommitted += 1
                        acc[description].penalties += penalty
                    } else {
                        acc[description] = { timesCommitted: 1, penalties: penalty }
                    }
                    return acc
                }, {})

                const overviewLines = Object.entries(tortOverview).map(
                    ([description, { timesCommitted, penalties }]) => `${description} x${timesCommitted} = ${penalties}€`
                )

                await respondInChat(`${name} sakot:\n\n` + overviewLines.join('\n') + `\n\nYhteensä: ${person.sum}€`)
                return
            },
        }

        // parses bot command from a message
        function parseCommand(message) {
            if ('entities' in message) {
                const commands = message.entities.filter(({ type }) => type === 'bot_command')

                // only allow one command per message, and message must begin with command
                if (message.text[0] !== '/' || commands[0].offset !== 0) {
                    return {
                        valid: false,
                        reason: 'bad command',
                    }
                }

                const command = message.text.slice(commands[0].offset, commands[0].offset + commands[0].length)
                const args = message.text.slice(commands[0].length + 1).trim()

                return {
                    valid: true,
                    command,
                    args,
                }
            } else {
                return {
                    valid: false,
                    reason: 'no command',
                }
            }
        }

        async function respondInChat(message) {
            await fetch(`${env.BOT_URL}/sendMessage?chat_id=${env.CHAT_ID}&text=${message}`)
        }

        // only allow post requests
        if (req.method !== 'POST') {
            // how to decline it
            return new Response('nope')
        }

        const body = await req.json()

        if ('message' in body) {
            const message = body.message
            const command = parseCommand(message)

            if (!command.valid) {
                return new Response('oh well')
            } else {
                if (command.command in commandHandlers) {
                    await commandHandlers[command.command](env, command.args)
                    return new Response()
                }

                // Check if command is a tort-command
                const torts = await env.TORT.list()
                const tortCommands = torts.keys.map(({ name }) => '/' + name)

                if (tortCommands.includes(command.command)) {
                    await recordTort(env, command.command.slice(1), command.args)
                } else {
                    await respondInChat(`"${command.command}" ei ole komento`)
                }
            }
        }

        // const data = await env.MY_BUCKET.get('jotain')
        return new Response()
    },
}

const huoh = [
    'Anna mun kaikki kestää',
    'Vittu mikä äijä',
    'Vittu sen kanssa',
    'Nyt vittu...',
    'Yrittäs ees',
    '...',
    '..',
    'No voi huoh',
    'Ei jumalauta nyt oikeesti',
    'Mikä vittu sitäki vaivaa',
    'KYS',
    'Jumalauta mikä goblin',
]
