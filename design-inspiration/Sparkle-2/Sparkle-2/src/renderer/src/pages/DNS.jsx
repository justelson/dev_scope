import { useState, useEffect } from "react"
import { invoke } from "@/lib/electron"
import RootDiv from "@/components/RootDiv"
import Button from "@/components/ui/button"
import Modal from "@/components/ui/modal"
import { toast } from "react-toastify"
import { Globe, Shield, Settings, RefreshCw, CheckCircle, AlertCircle, Info } from "lucide-react"
import { Cloud } from "lucide-react"
import log from "electron-log/renderer"

const dnsProviders = [
  {
    id: "cloudflare",
    name: "Cloudflare",
    primary: "1.1.1.1",
    secondary: "1.0.0.1",
    description: "Fast, secure, and privacy-focused DNS",
    features: ["Fast", "Privacy-focused", "Security"],
    recommended: true,
    color: "text-orange-500",
    icon: <Globe className="w-5 h-5" />,
  },
  {
    id: "google",
    name: "Google",
    primary: "8.8.8.8",
    secondary: "8.8.4.4",
    description: "Reliable and widely used DNS service",
    features: ["Reliable", "Fast", "Widely supported"],
    color: "text-blue-500",
    icon: <Globe className="w-5 h-5" />,
  },
  {
    id: "opendns",
    name: "OpenDNS",
    primary: "208.67.222.222",
    secondary: "208.67.220.220",
    description: "Cisco-owned DNS with content filtering",
    features: ["Content filtering", "Reliable", "Security"],
    color: "text-green-500",
    icon: <Shield className="w-5 h-5" />,
  },
  {
    id: "quad9",
    name: "Quad9",
    primary: "9.9.9.9",
    secondary: "149.112.112.112",
    description: "Security-focused DNS with threat blocking",
    features: ["Security", "Threat blocking", "Privacy"],
    color: "text-purple-500",
    icon: <Shield className="w-5 h-5" />,
  },
  {
    id: "adguard",
    name: "AdGuard DNS",
    primary: "94.140.14.14",
    secondary: "94.140.15.15",
    description: "Blocks ads, trackers, malware",
    features: ["Security", "Threat blocking", "Privacy"],
    color: "text-teal-500",
    icon: <Cloud className="w-5 h-5" />,
  },
  {
    id: "automatic",
    name: "Automatic (DHCP)",
    primary: "Auto",
    secondary: "Auto",
    description: "Use your ISP's default DNS servers",
    features: ["Default", "ISP provided", "No configuration"],
    color: "text-gray-500",
    icon: <Settings className="w-5 h-5" />,
  },
]

export default function DNSPage() {
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [currentDNS, setCurrentDNS] = useState(null)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [customDNS, setCustomDNS] = useState({ primary: "", secondary: "" })
  const [showCustom, setShowCustom] = useState(false)

  useEffect(() => {
    getCurrentDNS()
  }, [])

  const getCurrentDNS = async () => {
    try {
      const result = await invoke({
        channel: "dns:get-current",
      })

      if (result.success) {
        setCurrentDNS(result.data)
      }
    } catch (error) {
      console.error("Error getting current DNS:", error)
      log.error("Error getting current DNS:", error)
    }
  }

  const applyDNS = async (provider) => {
    setLoading(true)
    const toastId = toast.loading(`Applying ${provider.name} DNS...`)

    try {
      let payload
      if (provider.id === "custom") {
        payload = {
          dnsType: "custom",
          primaryDNS: customDNS.primary,
          secondaryDNS: customDNS.secondary,
        }
      } else {
        payload = {
          dnsType: provider.id,
        }
      }

      const result = await invoke({
        channel: "dns:apply",
        payload,
      })

      if (result.success) {
        toast.update(toastId, {
          render: `${provider.name} DNS applied successfully!`,
          type: "success",
          isLoading: false,
          autoClose: 3000,
        })
        await getCurrentDNS()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast.update(toastId, {
        render: `Failed to apply DNS: ${error.message}`,
        type: "error",
        isLoading: false,
        autoClose: 5000,
      })
      log.error("Failed to apply DNS:", error)
    } finally {
      setLoading(false)
      setModalOpen(false)
    }
  }

  const openConfirmationModal = (provider) => {
    setSelectedProvider(provider)
    setModalOpen(true)
  }

  const validateCustomDNS = (dns) => {
    // regex is weird
    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    return ipRegex.test(dns)
  }

  const isCustomDNSValid = () => {
    return (
      customDNS.primary &&
      validateCustomDNS(customDNS.primary) &&
      (!customDNS.secondary || validateCustomDNS(customDNS.secondary))
    )
  }

  return (
    <>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="bg-sparkle-card p-6 rounded-2xl border border-sparkle-border text-sparkle-text w-[90vw] max-w-md">
          <h2 className="text-lg font-semibold mb-4">Confirm DNS Change</h2>
          {selectedProvider && (
            <>
              <p className="mb-4">
                You are about to change your DNS servers to{" "}
                <span className="text-sparkle-primary font-medium">{selectedProvider.name}</span>.
              </p>
              <div className="bg-sparkle-border-secondary border border-sparkle-border p-3 rounded-md mb-4">
                <div className="text-sm">
                  <div>
                    <strong>Primary:</strong> {selectedProvider.primary}
                  </div>
                  <div>
                    <strong>Secondary:</strong> {selectedProvider.secondary}
                  </div>
                </div>
              </div>
              <p className="text-sm text-sparkle-text-secondary mb-4">
                This will change DNS settings for all active network adapters and flush the DNS
                cache.
              </p>
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setModalOpen(false)} variant="secondary">
              Cancel
            </Button>
            <Button onClick={() => applyDNS(selectedProvider)} disabled={loading}>
              {loading ? "Applying..." : "Apply"}
            </Button>
          </div>
        </div>
      </Modal>
      <RootDiv>
        <div className="bg-sparkle-bg text-sparkle-text pb-10">
          <div className="bg-sparkle-card border border-sparkle-border p-4 rounded-2xl mb-6">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="font-semibold">Current DNS Settings</h2>
              <Button onClick={getCurrentDNS} variant="" size="sm" className="ml-auto">
                <RefreshCw className="w-5 h-5" />
              </Button>
            </div>

            {currentDNS && currentDNS.length > 0 ? (
              <div className="space-y-2">
                {currentDNS.map((dns, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="font-medium">{dns.adapter}:</span>
                    <span className="text-sparkle-text-secondary">{dns.servers}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-sparkle-text-secondary">
                <AlertCircle className="w-4 h-4" />
                <span>Loading Network Info, this may take a while...</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {dnsProviders.map((provider) => (
              <button
                key={provider.id}
                onClick={() => openConfirmationModal(provider)}
                disabled={loading}
                className="bg-sparkle-card border border-sparkle-border p-4 rounded-2xl hover:border-sparkle-primary transition text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={provider.color}>{provider.icon}</div>

                  <div>
                    <h3 className="font-semibold">
                      {provider.name}
                      {provider.recommended && (
                        <span className="text-xs text-sparkle-primary ml-2">Recommended</span>
                      )}
                    </h3>

                    <p className="text-sm text-sparkle-text-secondary">
                      {provider.primary} / {provider.secondary}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-sparkle-text-secondary">{provider.description}</p>
                {/* <div className="flex flex-wrap gap-1 mt-3">
                {provider.features.map((feature, index) => (
                  <span key={index} className="px-2 py-1 bg-sparkle-border text-xs rounded-md">
                    {feature}
                  </span>
                ))}
              </div> */}
              </button>
            ))}
          </div>

          <div className="bg-sparkle-card border border-sparkle-border p-4 rounded-2xl mb-6">
            <div className="flex items-center gap-3 ">
              <Settings className="w-5 h-5 text-purple-500" />
              <h2 className="font-semibold">Custom DNS</h2>
              <Button onClick={() => setShowCustom(!showCustom)} size="sm">
                {showCustom ? "Hide" : "Show"}
              </Button>
            </div>

            {showCustom && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Primary DNS</label>
                    <input
                      type="text"
                      value={customDNS.primary}
                      onChange={(e) =>
                        setCustomDNS((prev) => ({ ...prev, primary: e.target.value }))
                      }
                      placeholder="e.g., 1.1.1.1"
                      className="w-full px-3 py-2 bg-sparkle-border border border-sparkle-border-secondary rounded-lg text-sparkle-text focus:outline-none focus:border-sparkle-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Secondary DNS (Optional)
                    </label>
                    <input
                      type="text"
                      value={customDNS.secondary}
                      onChange={(e) =>
                        setCustomDNS((prev) => ({ ...prev, secondary: e.target.value }))
                      }
                      placeholder="e.g., 1.0.0.1"
                      className="w-full px-3 py-2 bg-sparkle-border border border-sparkle-border-secondary rounded-lg text-sparkle-text focus:outline-none focus:border-sparkle-primary"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-sparkle-text-secondary">
                  <Info className="w-4 h-4" />
                  <span>Enter valid IPv4 addresses for custom DNS servers</span>
                </div>

                <Button
                  onClick={() =>
                    openConfirmationModal({
                      id: "custom",
                      name: "Custom DNS",
                      primary: customDNS.primary,
                      secondary: customDNS.secondary,
                    })
                  }
                  disabled={!isCustomDNSValid() || loading}
                  className="w-full"
                >
                  Apply Custom DNS
                </Button>
              </div>
            )}
          </div>
        </div>
      </RootDiv>
    </>
  )
}
